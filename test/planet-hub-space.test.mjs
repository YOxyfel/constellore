import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import * as RELEASE_THREE from "../public/vendor/three/planet-hub-three.mjs";
import {
  PLANET_HUB_GRID_CARRIER_COUNT,
  PLANET_HUB_GRID_EDGE_FADE_START,
  PLANET_HUB_SPACE_LAYER_CONFIG,
  PLANET_HUB_SPACE_SKY_RADIUS,
  createPlanetHubConstellationData,
  createPlanetHubSpaceEnvironment,
  createPlanetHubStarFieldData,
  resolvePlanetHubGridEdgeOpacity,
  resolvePlanetHubGridLod,
  resolvePlanetHubGridPlaneOpacity,
  resolvePlanetHubPlaneMeters,
  resolvePlanetHubSpaceViewDepth,
  resolvePlanetHubSpaceLayerUrl
} from "../public/planet-hub-space.mjs";
import {
  PLANET_HUB_DISTANCE_METERS,
  PLANET_HUB_VIEW_BANDS,
  PLANET_HUB_ZOOM_ANCHOR_PROGRESS,
  resolvePlanetHubRepresentedDistance
} from "../public/planet-hub-zoom.mjs";
import { createCelestialAtlas } from "../public/celestial-atlas-runtime.mjs";

function layerRecords(quality = "low") {
  return PLANET_HUB_SPACE_LAYER_CONFIG.map(({ id }, index) => ({
    id,
    url: `./art/planet-hub/space-layers/${String(index + 1).padStart(2, "0")}-${id}-${quality}.webp`
  }));
}

class ImmediateTextureLoader {
  constructor({ failAt = -1 } = {}) {
    this.failAt = failAt;
    this.urls = [];
    this.textures = [];
  }

  load(url, onLoad, _progress, onError) {
    const index = this.urls.push(url) - 1;
    if (index === this.failAt) {
      onError?.(new Error("fixture failure"));
      return null;
    }
    const texture = new THREE.Texture();
    this.textures.push(texture);
    onLoad(texture);
    return texture;
  }
}

function environment(options = {}) {
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 20);
  camera.position.set(0, 0.08, 4.5);
  camera.lookAt(0, -1.075, 0);
  return createPlanetHubSpaceEnvironment(THREE, { camera, width: 1280, height: 720, ...options });
}

function frustumCornersOnHorizontalPlane(camera, planeY) {
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
    const point = new THREE.Vector3(x, y, 0.5).unproject(camera);
    const direction = point.sub(camera.position).normalize();
    const distance = (planeY - camera.position.y) / direction.y;
    assert.ok(Number.isFinite(distance) && distance > 0,
      `frustum corner ${x},${y} must meet the chart in front of the camera`);
    return camera.position.clone().addScaledVector(direction, distance);
  });
}

test("quality tiers create deterministic bounded nebula layers", () => {
  const low = environment({ quality: "low", seed: 73 });
  const repeat = environment({ quality: "low", seed: 73 });
  const standard = environment({ quality: "standard", seed: 74 });
  assert.equal(low.noiseTexture.image.width, 128);
  assert.equal(standard.noiseTexture.image.width, 256);
  assert.equal(low.dome.geometry.parameters.widthSegments, 32);
  assert.equal(standard.dome.geometry.parameters.widthSegments, 48);
  assert.deepEqual(low.noiseTexture.image.data, repeat.noiseTexture.image.data);
  assert.notDeepEqual(low.noiseTexture.image.data, standard.noiseTexture.image.data.slice(0, low.noiseTexture.image.data.length));
  low.dispose();
  repeat.dispose();
  standard.dispose();
});

test("space constructs and disposes against the actual trimmed release Three.js module", () => {
  assert.equal(RELEASE_THREE.LineLoop, undefined);
  assert.equal(RELEASE_THREE.CanvasTexture, undefined);
  assert.equal(RELEASE_THREE.SpriteMaterial, undefined);
  assert.equal(RELEASE_THREE.Sprite, undefined);
  assert.equal(RELEASE_THREE.LinearMipmapLinearFilter, undefined);
  const camera = new RELEASE_THREE.PerspectiveCamera(28, 16 / 9, 0.05, 448);
  camera.position.set(0, 2.4, 6.5);
  camera.lookAt(0, -1.075, 0);
  const view = createPlanetHubSpaceEnvironment(RELEASE_THREE, {
    camera,
    width: 1280,
    height: 720,
    quality: "low"
  });
  view.setViewDepth({ progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system, band: "system" });
  assert.equal(view.gridCarriers.length, 3);
  assert.ok(view.planeMeters.every(({ ring }) => ring.isLineSegments));
  assert.ok(view.planeMeters.every(({ label }) => label.isMesh && label.material.map?.isDataTexture));
  assert.equal(view.snapshot().gridTransitionOpacity, 1);
  assert.equal(view.dispose(), true);
});

test("three adjacent logarithmic grid decades remain aligned and crossfade without pops", () => {
  for (const size of [1e-7, 0.038, 1, 4.9, 10, 8.2e9]) {
    const lod = resolvePlanetHubGridLod(size);
    assert.equal(lod.layers.length, PLANET_HUB_GRID_CARRIER_COUNT);
    assert.deepEqual(lod.layers.map(({ decade }) => decade),
      [lod.baseDecade - 1, lod.baseDecade, lod.baseDecade + 1]);
    assert.ok(Math.abs(lod.layers.reduce((sum, layer) => sum + layer.weight, 0) - 1) < 1e-12);
    assert.ok(Math.abs(lod.layers[1].cellSize / lod.layers[0].cellSize - 10) < 1e-12);
    assert.ok(Math.abs(lod.layers[2].cellSize / lod.layers[1].cellSize - 10) < 1e-12);
    assert.ok(lod.layers.every((layer) => layer.weight >= 0 && layer.weight <= 1));
  }

  const below = resolvePlanetHubGridLod(10 ** (2 - 1e-8));
  const above = resolvePlanetHubGridLod(10 ** (2 + 1e-8));
  const weightsByDecade = (lod) => new Map(lod.layers.map((layer) => [layer.decade, layer.weight]));
  const before = weightsByDecade(below), after = weightsByDecade(above);
  for (const decade of [1, 2]) {
    assert.ok(Math.abs(before.get(decade) - after.get(decade)) < 1e-7,
      `physical decade ${decade} must retain opacity while carrier slots rebase`);
  }
  assert.ok((before.get(0) || 0) < 1e-14);
  assert.ok((after.get(3) || 0) < 1e-14);
});

test("grid carrier edge and camera-plane visibility fade continuously to black", () => {
  assert.equal(resolvePlanetHubGridEdgeOpacity({ normalizedRadius: 0 }), 1);
  assert.equal(resolvePlanetHubGridEdgeOpacity({ normalizedRadius: PLANET_HUB_GRID_EDGE_FADE_START }), 1);
  const runway = resolvePlanetHubGridEdgeOpacity({ normalizedRadius: 0.86 });
  assert.ok(runway > 0 && runway < 1);
  assert.equal(resolvePlanetHubGridEdgeOpacity({ normalizedRadius: 1 }), 0);
  assert.equal(resolvePlanetHubGridEdgeOpacity({ normalizedRadius: 2 }), 0);

  assert.equal(resolvePlanetHubGridPlaneOpacity({ cameraSide: -1, viewNormalDot: -1 }), 0,
    "the chart is strictly one-sided");
  assert.equal(resolvePlanetHubGridPlaneOpacity({ cameraSide: 1, viewNormalDot: 0 }), 0,
    "an edge-on chart disappears before its texture stretches");
  const edgeRamp = resolvePlanetHubGridPlaneOpacity({ cameraSide: 1, viewNormalDot: -0.08 });
  assert.ok(edgeRamp > 0 && edgeRamp < 1);
  assert.equal(resolvePlanetHubGridPlaneOpacity({ cameraSide: 1, viewNormalDot: -1 }), 1);
});

test("plane meters are separate adjacent physical decades with triangular weights and units", () => {
  const meters = resolvePlanetHubPlaneMeters({ targetRadiusMeters: 3.2e11, metersPerUnit: 1e10 });
  assert.equal(meters.meters.length, 2);
  assert.deepEqual(meters.meters.map(({ label }) => label), ["1 AU", "10 AU"]);
  assert.ok(Math.abs(meters.meters[0].radiusWorld - PLANET_HUB_DISTANCE_METERS.au / 1e10) < 1e-9);
  assert.ok(Math.abs(meters.meters[1].radiusWorld - PLANET_HUB_DISTANCE_METERS.au * 10 / 1e10) < 1e-8);
  assert.ok(Math.abs(meters.meters.reduce((sum, meter) => sum + meter.weight, 0) - 1) < 1e-12);
  assert.deepEqual(meters.meters.map(({ unit }) => unit), ["AU", "AU"]);
  assert.ok(meters.meters.every((meter) => meter.label.endsWith(` ${meter.unit}`)));

  const below = resolvePlanetHubPlaneMeters({ targetRadiusMeters: PLANET_HUB_DISTANCE_METERS.au * 10 ** (1 - 1e-8), metersPerUnit: 1 });
  const above = resolvePlanetHubPlaneMeters({ targetRadiusMeters: PLANET_HUB_DISTANCE_METERS.au * 10 ** (1 + 1e-8), metersPerUnit: 1 });
  assert.ok(Math.abs(below.meters[1].weight - above.meters[0].weight) < 1e-7,
    "the same physical ring survives a meter-decade handoff without an opacity jump");
});

test("semantic zoom reveals deeper stars and constellations without moving the sky dome", () => {
  const planet = resolvePlanetHubSpaceViewDepth({ progress: 0, band: "planet" });
  const system = resolvePlanetHubSpaceViewDepth({
    progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system,
    band: "system"
  });
  const universe = resolvePlanetHubSpaceViewDepth({ progress: 1, band: "universe" });
  assert.equal(planet.band, "planet");
  assert.equal(universe.band, "universe");
  assert.ok(universe.starOpacity > planet.starOpacity);
  assert.ok(universe.constellationOpacity > planet.constellationOpacity);
  assert.equal(planet.chartOpacity, 0, "the chart grid never crowds the close planet view");
  assert.ok(system.chartOpacity > universe.chartOpacity,
    "the system chart is strongest while the distant universe view quiets it again");
  assert.ok(system.constellationOpacity > universe.constellationOpacity,
    "constellations peak at system-reading scale instead of becoming a universe-scale cage");

  const view = environment({ quality: "standard" });
  const domeScale = view.dome.scale.clone();
  const initialStars = view.starField.material.uniforms.uOpacity.value;
  const depth = view.setViewDepth({ progress: 1, band: "universe" });
  assert.equal(depth.band, "universe");
  assert.ok(view.starField.material.uniforms.uOpacity.value > initialStars);
  assert.ok(view.constellations.material.opacity > 0.08);
  assert.equal(view.dome.material.uniforms.uChartOpacity, undefined,
    "the camera-relative sky shader no longer owns the chart grid");
  assert.equal(view.artComposite.material.uniforms.uChartOpacity, undefined);
  assert.equal(view.gridFamily.visible, true,
    "one logarithmic plane persists through galactic and universe distances");
  assert.equal(view.worldGrid.visible, true,
    "the middle diagnostic carrier remains active throughout the deep chart");
  assert.equal(view.planeMeter.visible, true,
    "the independent ruler changes physical units without replacing the coordinate plane");
  assert.deepEqual(view.dome.scale.toArray(), domeScale.toArray(),
    "semantic depth changes shader emphasis, never the camera-centred sky radius");
  assert.equal(view.snapshot().viewBand, "universe");
  view.dispose();
});

test("space fallback bands derive from the physical-distance zoom anchors", () => {
  for (const band of PLANET_HUB_VIEW_BANDS) {
    assert.equal(resolvePlanetHubSpaceViewDepth({
      progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS[band]
    }).band, band, `${band} must not retain a compressed-camera threshold`);
  }
});

test("Galaxy owns a galactic chart while the solar atlas becomes one marker inside the Milky Way", () => {
  const depth = resolvePlanetHubSpaceViewDepth({
    progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.galaxy,
    band: "galaxy"
  });
  assert.equal(depth.band, "galaxy");
  assert.ok(depth.starOpacity > 0);
  assert.ok(depth.constellationOpacity >= 0);
  assert.ok(depth.chartOpacity >= 0);

  const view = environment({ quality: "standard" });
  view.setViewDepth({ progress: 1, band: "universe" });
  assert.equal(view.snapshot().viewBand, "universe");
  assert.equal(view.worldGrid.visible, true,
    "Galaxy retains the same recentered logarithmic carrier used by Orbit and System");
  assert.equal(view.gridFamily.visible, true,
    "semantic ownership cannot swap the sole native-style grid family");

  const atlas = createCelestialAtlas(THREE, { quality: "low", originBodyId: "earth" });
  assert.equal(atlas.root.getObjectByName("celestial-atlas-milky-way"), undefined,
    "the Milky Way remains lazy before galactic zoom");
  const presentation = atlas.setSemanticTier({ band: "universe", progress: 1 });
  const milkyWay = atlas.root.getObjectByName("celestial-atlas-milky-way");
  const marker = atlas.root.getObjectByName("celestial-solar-system-marker");
  const galacticGrid = atlas.root.getObjectByName("celestial-galaxy-grid");
  assert.ok(milkyWay?.visible, "Galaxy must render a Milky Way visual owner");
  assert.ok(galacticGrid?.isLineSegments,
    "the lazy galactic atlas must own real world-space chart geometry");
  assert.ok(marker?.visible, "the detailed solar atlas must collapse to one solar-system marker");
  assert.equal(atlas.solarRoot.visible, false,
    "the full solar system and its far marker must never co-render");
  assert.ok(presentation.galaxyOpacity > 0.8);
  assert.equal(presentation.solarMarkerOpacity, 1);
  assert.equal(presentation.solarDetailOpacity, 0);
  atlas.dispose();
  view.dispose();
});

test("GPU stars and constellation segments are deterministic, spherical, and bounded", () => {
  const low = createPlanetHubStarFieldData({ count: 72, radius: 8.34, seed: 73 });
  const repeat = createPlanetHubStarFieldData({ count: 72, radius: 8.34, seed: 73 });
  const other = createPlanetHubStarFieldData({ count: 72, radius: 8.34, seed: 74 });
  assert.deepEqual(low.positions, repeat.positions);
  assert.notDeepEqual(low.positions, other.positions);
  assert.equal(low.positions.length, 72 * 3);
  for (let index = 0; index < low.positions.length; index += 3) {
    const radius = Math.hypot(low.positions[index], low.positions[index + 1], low.positions[index + 2]);
    assert.ok(radius >= 8.2 && radius <= 8.5);
  }
  const lines = createPlanetHubConstellationData({ groups: 7, seed: 73 });
  assert.equal(lines.groups, 7);
  assert.ok(lines.segments >= 21);
  assert.equal(lines.positions.length, lines.segments * 6);
});

test("space remains transparent and depth-tested behind the planet", () => {
  const view = environment({ quality: "low" });
  assert.equal(view.root.name, "planet-hub-space-environment");
  assert.equal(view.dome.material.transparent, true);
  assert.equal(view.dome.material.depthTest, true);
  assert.equal(view.dome.material.depthWrite, false);
  assert.equal(view.dome.material.side, THREE.BackSide);
  assert.equal(view.dome.material.toneMapped, false);
  assert.equal(view.starField.isPoints, true);
  assert.equal(view.starField.material.depthTest, true);
  assert.equal(view.starField.material.depthWrite, false);
  assert.equal(view.starField.material.toneMapped, false);
  assert.equal(view.constellations.isLineSegments, true);
  assert.equal(view.constellations.material.depthTest, true);
  assert.equal(view.constellations.material.depthWrite, false);
  assert.equal(view.constellationNodes.isPoints, true);
  assert.equal(view.constellationNodes.geometry, view.constellations.geometry,
    "node lights reuse line vertices and add no duplicate geometry allocation");
  assert.equal(view.constellationNodes.material.size, 2.8,
    "constellation nodes remain crisp constant-pixel marks at every semantic zoom band");
  assert.equal(view.constellationNodes.material.depthWrite, false);
  assert.equal(view.constellationNodes.material.depthTest, true);
  assert.equal(view.worldGrid.isMesh, true);
  assert.equal(view.gridFamily.isGroup, true);
  assert.equal(view.gridFamily.children.length, PLANET_HUB_GRID_CARRIER_COUNT);
  assert.ok(view.gridCarriers.every((carrier) => carrier.isMesh));
  assert.equal(new Set(view.gridCarriers.map((carrier) => carrier.geometry)).size, 1,
    "all logarithmic carriers share one two-triangle geometry allocation");
  assert.equal(view.worldRoot.children.length, 2,
    "one grid family and one independent plane meter are the only core chart roots");
  assert.equal(view.worldRoot.children[0], view.gridFamily);
  assert.equal(view.worldRoot.children[1], view.planeMeter);
  assert.equal(view.planeMeter.children.filter((child) => child.isLineSegments).length, 2);
  assert.equal(view.planeMeter.children.filter((child) => child.isMesh).length, 2);
  assert.ok(view.planeMeters.every(({ label }) => label.material.isMeshBasicMaterial));
  assert.ok(view.planeMeters.every(({ label }) => label.material.map?.isDataTexture));
  assert.ok(view.planeMeters.every(({ label }) => label.material.map.minFilter === THREE.LinearFilter
    && label.material.map.generateMipmaps === false));
  assert.equal(view.gridTexture.image.width, 32);
  assert.equal(view.gridTexture.wrapS, THREE.RepeatWrapping);
  assert.equal(view.gridTexture.wrapT, THREE.RepeatWrapping);
  assert.equal(view.worldGrid.material.depthTest, true);
  assert.equal(view.worldGrid.material.depthWrite, false);
  assert.equal(view.worldGrid.material.isShaderMaterial, true);
  assert.match(view.worldGrid.material.fragmentShader, /texture2D\(uGridTexture, gridUv\)[.]a/,
    "each carrier repeats one procedural cross texture instead of allocating finite lines");
  assert.match(view.worldGrid.material.fragmentShader,
    /radialDistance\s*=\s*length\(vCarrierPosition\)[\s\S]*smoothstep\(uEdgeFadeStart,\s*1[.]0,\s*radialDistance\)/,
    "the carrier disappears radially before any square geometry edge can become visible");
  assert.equal(view.worldGrid.material.uniforms.uOpacity.value, view.worldGrid.material.opacity);
  assert.equal(view.worldGrid.material.blending, THREE.AdditiveBlending,
    "normalized additive weights cannot breathe when aligned decade lines overlap");
  const diagnostics = view.snapshot();
  assert.equal(diagnostics.gpuStarCount, 1500);
  assert.ok(diagnostics.constellationSegments > 0);
  assert.equal(diagnostics.gridFamilyCount, 1);
  assert.equal(diagnostics.gridCarrierCount, 3);
  assert.equal(diagnostics.planeMeterCount, 2);
  assert.ok(Math.abs(diagnostics.gridWeightSum - 1) < 1e-12);
  view.dispose();
});

test("the semantic grid is actual world geometry on the active ecliptic", () => {
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 448);
  camera.position.set(0, 2.4, 6.5);
  camera.lookAt(0, -1.075, 0);
  const view = environment({ quality: "standard", camera });
  view.setViewDepth({ progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit, band: "orbit" });
  const orbitExtent = view.worldGrid.scale.x;
  const orbitCells = view.snapshot().gridCellSizes;
  assert.equal(view.worldGrid.visible, true);
  assert.equal(view.gridFamily.parent, view.worldRoot);
  assert.equal(view.worldGrid.parent, view.gridFamily);
  view.root.position.set(3, 4, 5);
  view.update(0, 0);
  view.worldRoot.updateMatrixWorld(true);
  assert.notEqual(view.gridFamily.parent, view.root,
    "world geometry must never inherit the camera-following sky transform");
  assert.equal(Number(view.gridFamily.getWorldPosition(new THREE.Vector3()).y.toFixed(4)), 0);

  assert.deepEqual(view.setWorldGridAnchor({ position: [2, 1, -3], bodyRadius: 0.5 }), {
    position: [2, 1, -3],
    bodyRadius: 0.5
  });
  view.worldRoot.updateMatrixWorld(true);
  assert.equal(Number(view.gridFamily.getWorldPosition(new THREE.Vector3()).y.toFixed(4)), 1);
  assert.deepEqual(view.worldGrid.material.uniforms.uGridOrigin.value.toArray(), [2, -3],
    "recentring finite carrier geometry cannot slide the measurement lattice off its focused pivot");
  assert.deepEqual(view.planeMeter.position.toArray().map((value) => Number(value.toFixed(4))), [2, 1.0002, -3],
    "the independent meter remains centred on the semantic pivot");

  assert.deepEqual(view.setWorldGridAnchor({
    scope: "system",
    position: [-4, 2, 6],
    bodyRadius: 2
  }), {
    position: [-4, 2, 6],
    bodyRadius: 2
  });
  assert.equal(Number(view.gridFamily.getWorldPosition(new THREE.Vector3()).y.toFixed(4)), 2);
  assert.deepEqual(view.worldGrid.material.uniforms.uGridOrigin.value.toArray(), [-4, 6]);

  camera.position.set(-4, 16, 30);
  camera.lookAt(-4, 2, 6);
  view.resize({ camera, width: 1280, height: 720 });
  view.setViewDepth({ progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system, band: "system" });
  assert.ok(view.worldGrid.scale.x > orbitExtent,
    "the carrier expands from camera/FOV coverage rather than exposing a finite edge");
  assert.ok(view.snapshot().gridCellSizes[1] >= orbitCells[1],
    "camera distance selects adjacent coarser decades without a second grid family");
  assert.equal(view.gridFamily.visible, true);

  const hidden = view.setWorldGridPlaneView({ cameraSide: -1, viewNormalDot: 1 });
  assert.equal(hidden.opacity, 0);
  assert.equal(view.gridFamily.visible, false,
    "the explicit renderer seam retires the plane when the camera crosses underneath it");
  const automatic = view.setWorldGridPlaneView({ auto: true });
  assert.equal(automatic.automatic, true);
  assert.equal(view.gridFamily.visible, true);

  const fullChartOpacity = view.snapshot().chartOpacity;
  const fullStarOpacity = view.starField.material.uniforms.uOpacity.value;
  const fullConstellationOpacity = view.constellations.material.opacity;
  assert.equal(view.setWorldGridTransitionOpacity(0.25), 0.25);
  assert.equal(view.snapshot().gridTransitionOpacity, 0.25);
  assert.ok(Math.abs(view.snapshot().chartOpacity - fullChartOpacity * 0.25) < 1e-12);
  assert.ok(Math.abs(view.starField.material.uniforms.uOpacity.value - fullStarOpacity * 0.25) < 1e-12,
    "the legacy sky retires with its measuring plane before cosmological tiers take ownership");
  assert.ok(Math.abs(view.constellations.material.opacity - fullConstellationOpacity * 0.25) < 1e-12);
  assert.equal(view.setWorldGridTransitionOpacity(-2), 0);
  assert.equal(view.gridFamily.visible, false,
    "focus transitions can fade the plane before changing its visible anchor");
  assert.equal(view.starField.material.uniforms.uOpacity.value, 0);
  assert.equal(view.constellations.material.opacity, 0);
  assert.equal(view.artComposite.visible, false);
  assert.equal(view.dome.visible, false);
  assert.equal(view.setWorldGridTransitionOpacity(2), 1);
  assert.equal(view.gridFamily.visible, true);
  assert.ok(view.starField.material.uniforms.uOpacity.value > 0);

  camera.position.set(-4, -4, 12);
  camera.lookAt(-4, -0.15, 6);
  view.update(1, 0);
  assert.ok(view.snapshot().gridCameraSide < 0);
  assert.equal(view.snapshot().gridPlaneOpacity, 0);
  assert.equal(view.gridFamily.visible, false,
    "automatic camera-side detection hides the focused plane from underneath");

  view.dispose();
});

test("core space exposes one adaptive grid family continuously through galactic bands", () => {
  const view = environment({ quality: "standard" });
  const samples = [
    { progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.planet, band: "planet", owner: "none" },
    { progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit, band: "orbit", owner: "core" },
    {
      progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit
        + (PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system - PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit) * 0.65,
      band: "orbit",
      owner: "core"
    },
    { progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system, band: "system", owner: "core" },
    {
      progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.galaxy,
      band: "galaxy",
      gridOwner: "milky-way",
      owner: "core"
    },
    { progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.universe, band: "universe", gridOwner: "universe", owner: "core" }
  ];

  for (const sample of samples) {
    view.setViewDepth(sample);
    const familyVisible = view.gridFamily.visible
      && view.gridCarriers.some((carrier) => carrier.visible && carrier.material.opacity > 0.0005);
    assert.equal(familyVisible, sample.owner === "core",
      `${sample.band} at ${sample.progress} must ${sample.owner === "core" ? "own" : "retire"} the adaptive core grid`);
    assert.equal(view.worldRoot.children.filter((child) => child.userData.planetHubGridFamily).length, 1,
      `${sample.band} cannot create an overlapping local/system grid family`);
    assert.equal(view.planeMeter.visible, familyVisible,
      "the separate ruler follows chart ownership without becoming a second grid");
  }

  view.dispose();
});

test("the authoritative system chart covers every visible frustum corner at maximum system distance", () => {
  for (const aspect of [16 / 9, 9 / 16]) {
    const represented = resolvePlanetHubRepresentedDistance(PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system);
    const systemRadius = 4.5 * represented.localDollyFactor;
    const camera = new THREE.PerspectiveCamera(28, aspect, 0.05, 448);
    const horizontal = Math.sqrt(1 - 0.7 ** 2);
    camera.position.set(0, systemRadius * 0.7, systemRadius * horizontal);
    camera.lookAt(0, 0, 0);
    const view = environment({ quality: "standard", camera });
    view.setWorldGridAnchor({ scope: "system", position: [0, 0, 0], bodyRadius: 2.6 });
    view.setViewDepth({ progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system, band: "system" });
    view.worldRoot.updateMatrixWorld(true);

    const grid = view.worldGrid;
    const gridPosition = grid.getWorldPosition(new THREE.Vector3());
    const gridBounds = new THREE.Box3().setFromObject(grid);
    const corners = frustumCornersOnHorizontalPlane(camera, gridPosition.y);
    for (const [index, corner] of corners.entries()) {
      assert.ok(corner.x >= gridBounds.min.x - 1e-6 && corner.x <= gridBounds.max.x + 1e-6
        && corner.z >= gridBounds.min.z - 1e-6 && corner.z <= gridBounds.max.z + 1e-6,
      `aspect ${aspect.toFixed(3)} corner ${index} must remain over real grid geometry: ${JSON.stringify({
        corner: corner.toArray(),
        gridMin: gridBounds.min.toArray(),
        gridMax: gridBounds.max.toArray()
      })}`);
      const localCorner = grid.worldToLocal(corner.clone());
      assert.ok(Math.hypot(localCorner.x, localCorner.y) <= PLANET_HUB_GRID_EDGE_FADE_START + 1e-6,
        `aspect ${aspect.toFixed(3)} corner ${index} must remain inside the fully opaque chart carrier`);
    }
    view.dispose();
  }
});

test("one procedural texture family owns three co-located decade carriers", () => {
  const view = environment({ quality: "standard" });
  view.setViewDepth({ progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system, band: "system" });
  const identities = [...view.gridCarriers];
  const diagnostics = view.snapshot();
  assert.equal(view.gridFamily.children.length, 3);
  assert.ok(view.gridFamily.children.every((carrier) => carrier.isMesh && !carrier.isLineSegments));
  assert.ok(view.gridCarriers.every((carrier) => carrier.geometry === view.worldGrid.geometry));
  assert.ok(view.gridCarriers.every((carrier) => carrier.material.uniforms.uGridTexture.value === view.gridTexture));
  assert.ok(view.gridCarriers.every((carrier) => carrier.material.blending === THREE.AdditiveBlending));
  assert.equal(new Set(view.gridCarriers.map((carrier) => carrier.material.uniforms.uColor.value.getHex())).size, 1,
    "carrier tint cannot alter brightness while decade weights crossfade");
  assert.deepEqual(diagnostics.gridDecades,
    [diagnostics.gridDecades[0], diagnostics.gridDecades[0] + 1, diagnostics.gridDecades[0] + 2]);
  assert.ok(Math.abs(diagnostics.gridCellSizes[1] / diagnostics.gridCellSizes[0] - 10) < 1e-12,
    "adjacent grid carriers must retain a tenfold scale across floating-point runtimes");
  assert.ok(Math.abs(diagnostics.gridCellSizes[2] / diagnostics.gridCellSizes[1] - 10) < 1e-12,
    "adjacent grid carriers must retain a tenfold scale across floating-point runtimes");
  assert.ok(Math.abs(diagnostics.gridWeights.reduce((sum, weight) => sum + weight, 0) - 1) < 1e-12);
  const totalCarrierOpacity = view.gridCarriers.reduce((sum, carrier) => sum + carrier.material.opacity, 0);
  assert.deepEqual(view.gridCarriers.map((carrier) => Number((carrier.material.opacity / totalCarrierOpacity).toFixed(12))),
    diagnostics.gridWeights.map((weight) => Number(weight.toFixed(12))),
    "additive coplanar line brightness is exactly the normalized LOD weight sum");
  assert.equal(view.planeMeter.parent, view.worldRoot);
  assert.notEqual(view.planeMeter, view.gridFamily,
    "metric rings are not baked into the texture carrier family");

  const alpha = view.gridTexture.image.data.filter((_, index) => index % 4 === 3);
  assert.ok(alpha.some((value) => value === 255));
  assert.ok(alpha.some((value) => value === 0));
  assert.ok(alpha.some((value) => value > 0 && value < 255),
    "the procedural cross cell itself has antialiased line shoulders");
  view.update(0, 0);
  assert.deepEqual(view.gridCarriers, identities,
    "LOD rebasing mutates uniforms and never allocates replacement carrier objects");
  view.dispose();
});

test("every camera-following sky shell remains beyond the maximum semantic zoom radius", () => {
  const view = environment({ quality: "standard" });
  let maximumCameraRadius = 0;
  for (let index = 0; index <= 1000; index += 1) {
    maximumCameraRadius = Math.max(maximumCameraRadius,
      4.5 * resolvePlanetHubRepresentedDistance(index / 1000).localDollyFactor);
  }
  assert.ok(PLANET_HUB_SPACE_SKY_RADIUS > maximumCameraRadius);
  const minimumRadius = (object) => {
    const positions = object.geometry.getAttribute("position").array;
    let minimum = Infinity;
    for (let index = 0; index < positions.length; index += 3) {
      minimum = Math.min(minimum, Math.hypot(positions[index], positions[index + 1], positions[index + 2]));
    }
    return minimum;
  };
  assert.ok(minimumRadius(view.starField) > maximumCameraRadius,
    "stars can never sit between the far-zoom camera and the centered planet");
  assert.ok(minimumRadius(view.constellations) > maximumCameraRadius);
  assert.ok(view.dome.scale.x > maximumCameraRadius);
  assert.ok(view.artComposite.scale.x > maximumCameraRadius);
  view.dispose();
});

test("five authored distances load only the selected tier into one composite draw", () => {
  const loader = new ImmediateTextureLoader();
  const view = environment({
    quality: "standard",
    spaceLayers: layerRecords("standard"),
    textureLoader: loader,
    assetBaseUrl: "https://example.test/play/"
  });
  assert.equal(view.loadLayers(), true);
  assert.equal(loader.urls.length, 5);
  assert.ok(loader.urls.every((url) => url.endsWith("-standard.webp")));
  assert.ok(loader.urls.every((url) => !url.includes("-low.webp")));
  assert.equal(view.artComposite.geometry, view.dome.geometry, "fallback and authored pass share one bounded sphere geometry");
  assert.equal(view.snapshot().artLayersReady, 5);
  assert.equal(view.snapshot().spaceDrawPasses, 2, "the procedural pass remains only during the authored crossfade");
  for (let frame = 0; frame < 15; frame += 1) view.update(frame * 100, 0.1);
  assert.equal(view.snapshot().spaceDrawPasses, 1, "steady state is exactly one full-screen draw");
  assert.equal(view.snapshot().authoredCompositeReady, true);
  assert.equal(view.artComposite.renderOrder, -995);
  assert.equal(new Set(view.artLayers.map((layer) => layer.config.drift)).size, 5);
  assert.equal(view.artComposite.material.transparent, true);
  assert.equal(view.artComposite.material.depthTest, true, "stars must remain behind opaque planets");
  assert.equal(view.artComposite.material.depthWrite, false);
  assert.equal(view.artComposite.material.side, THREE.BackSide);
  assert.equal(view.artComposite.material.blending, THREE.AdditiveBlending);
  assert.equal(view.artComposite.material.toneMapped, false);
  for (const layer of view.artLayers) {
    assert.equal(view.artComposite.material.uniforms[`uLayer${layer.index}`].value, layer.texture);
    assert.equal(layer.texture.generateMipmaps, false);
    assert.equal(layer.texture.minFilter, THREE.LinearFilter);
    assert.equal(layer.texture.wrapS, THREE.RepeatWrapping);
  }
  assert.equal(resolvePlanetHubSpaceLayerUrl(layerRecords()[0], "https://example.test/play/"),
    "https://example.test/play/art/planet-hub/space-layers/01-cosmic-horizon-low.webp");
  view.dispose();
});

test("authored depth drift freezes for reduced motion and suspension", () => {
  const loader = new ImmediateTextureLoader();
  const view = environment({ spaceLayers: layerRecords(), textureLoader: loader });
  view.loadLayers();
  for (let frame = 0; frame < 15; frame += 1) view.update(frame * 100, 0.1);
  const shifts = () => view.artLayers.map((layer) => view.artComposite.material.uniforms[`uShift${layer.index}`].value.x);
  const animated = shifts();
  assert.equal(new Set(animated).size, 5);
  view.setEffects("reduced");
  view.update(2000, 0.1);
  assert.deepEqual(shifts(), animated);
  view.setEffects("full");
  view.suspend();
  view.update(2100, 0.1);
  assert.deepEqual(shifts(), animated);
  view.dispose();
});

test("effects-off defers requests and partial failures preserve the procedural underlay", () => {
  const deferred = new ImmediateTextureLoader();
  const hidden = environment({
    effectsLevel: "off",
    spaceLayers: layerRecords(),
    textureLoader: deferred
  });
  assert.equal(hidden.loadLayers(), false);
  assert.equal(deferred.urls.length, 0);
  hidden.setEffects("full");
  assert.equal(deferred.urls.length, 5);
  hidden.dispose();

  const partialLoader = new ImmediateTextureLoader({ failAt: 2 });
  const partial = environment({ spaceLayers: layerRecords(), textureLoader: partialLoader });
  partial.loadLayers();
  for (let frame = 0; frame < 15; frame += 1) partial.update(frame * 100, 0.1);
  assert.equal(partial.snapshot().artLayersReady, 4);
  assert.equal(partial.snapshot().artLayersFailed, 1);
  assert.equal(partial.dome.visible, true);
  assert.equal(partial.snapshot().spaceDrawPasses, 2);
  assert.ok(partial.dome.material.uniforms.uArtMix.value > 0);
  assert.ok(partial.dome.material.uniforms.uArtMix.value < 1);
  partial.dispose();
});

test("a texture resolving after disposal is released without attaching", () => {
  const callbacks = [];
  const loader = {
    load(url, onLoad) {
      callbacks.push({ url, onLoad });
      return new THREE.Texture();
    }
  };
  const view = environment({ spaceLayers: layerRecords(), textureLoader: loader });
  view.loadLayers();
  assert.equal(callbacks.length, 5);
  view.dispose();
  const late = new THREE.Texture();
  let disposed = 0;
  late.addEventListener("dispose", () => { disposed += 1; });
  callbacks[0].onLoad(late);
  assert.equal(disposed, 1);
  assert.equal(view.artLayers[0].texture, null);
});

test("space dome uses broad nebula shading without isolated noise-texel star wedges", async () => {
  const source = await readFile(new URL("../public/planet-hub-space.mjs", import.meta.url), "utf8");
  const procedural = source.slice(source.indexOf("function domeFragment"), source.indexOf("export function createPlanetHubSpaceEnvironment"));
  assert.doesNotMatch(procedural, /stars\s*=\s*smoothstep\s*\(\s*[.]97/,
    "isolated thresholded texels become rectangular orange wedges at the dome edge");
  assert.doesNotMatch(procedural, /analyticStar|directionalStars/,
    "the nebula dome cannot paint stars that bypass the real star shell's depth contract");
  assert.match(procedural, /directionalNoise\(vec3 p,vec3 weight/,
    "nebula noise must blend direction-space planes instead of pinching at a spherical UV pole");
  assert.match(procedural, /directionalNoise\(d,weight,3[.]2,drift\).*directionalNoise\(d,weight,7[.]5,/,
    "the 128/256 fallback texture must repeat finely enough to avoid screen-sized texel blocks");
  assert.doesNotMatch(procedural, /atan\(d[.]z,d[.]x\)|asin\(d[.]y\)/,
    "the live flight camera must never reveal equirectangular fan streaks at the dome poles");
  assert.match(source, /new THREE[.]Points\(starGeometry, starMaterial\)/,
    "stars are actual point geometry rather than magnified raster pixels");
  assert.match(source, /new THREE[.]LineSegments\(constellationGeometry, constellationMaterial\)/,
    "constellation paths are crisp geometry rather than painted into a panorama");
  assert.match(source, /new THREE[.]Points\(constellationGeometry, constellationNodeMaterial\)/,
    "small constellation anchors reuse the line buffer instead of adding a second geometry pack");
  assert.doesNotMatch(source, /chartGrid\(|vViewDir|uChartOpacity/,
    "no chart grid may be painted into a camera-relative sky shader");
  assert.match(source, /const gridGeometry = new THREE[.]PlaneGeometry\(2, 2\)/,
    "one minimal carrier geometry underpins every logarithmic texture layer");
  assert.match(source, /Array[.]from\(\{ length: PLANET_HUB_GRID_CARRIER_COUNT \}[\s\S]*?new THREE[.]Mesh\(gridGeometry, createGridMaterial/,
    "exactly three co-located texture carriers form the native-style LOD family");
  assert.match(source, /new THREE[.]DataTexture\([\s\S]*?gridTexture[.]wrapS = gridTexture[.]wrapT = THREE[.]RepeatWrapping/,
    "the orthogonal lattice comes from one generated repeating cross texture");
  assert.match(source, /radialDistance = length\(vCarrierPosition\)[\s\S]*?smoothstep\(uEdgeFadeStart, 1[.]0, radialDistance\)/,
    "a radial shader runway hides the finite carrier before its edge");
  assert.doesNotMatch(source, /createGridGeometry|systemWorldGrid|worldGridMajor/,
    "retired finite local/system LineSegments families cannot return");
  assert.match(source, /const worldRoot = new THREE[.]Group\(\)/,
    "world-space overlays have a root separate from the camera-following sky");
  assert.match(source, /worldRoot[.]add\(gridFamily, planeMeter\)/,
    "the ruler is a sibling of, never geometry inside, the one grid family");
  assert.match(source, /new THREE[.]LineSegments\(meterGeometry, ringMaterial\)/,
    "meter circles remain crisp independent world geometry");
  assert.match(source, /new THREE[.]Mesh\(meterLabelGeometry, labelMaterial\)/,
    "each physical meter decade carries a trimmed-vendor compatible billboard label");
  assert.doesNotMatch(source, /THREE[.](?:LineLoop|CanvasTexture|SpriteMaterial|Sprite|LinearMipmapLinearFilter)/,
    "space must construct against the shipped trimmed Three.js export surface");
  assert.doesNotMatch(source, /galacticWorldGrid/,
    "galactic geometry stays in the lazy atlas rather than inflating the core environment");
  assert.doesNotMatch(source, /root[.]add\(worldGrid\)/);
  assert.match(source, /gl_PointCoord/,
    "the star shader rounds and feathers point sprites instead of exposing square GL points");
  assert.match(source, /uAccent\s*\*\s*\(ribbon\s*\*\s*[.]035\s*\+\s*galaxy\s*\*\s*[.]012\)/,
    "destination color should remain limited to continuous nebula and galactic ribbons");
  assert.match(source, /vec3 cleanPlate\(sampler2D plate/,
    "authored WebP plates must pass through one shared compression-floor cleanup function");
  assert.match(source, /smoothstep\(threshold,threshold\+softness,luminance\)/,
    "near-black macroblocks are gated before additive blending");
  assert.match(source, /uDeepStarRepeat/,
    "the dense-star plate is resampled instead of magnifying source pixels into soft blocks");
  assert.match(source, /quality\s*===\s*["']standard["']\s*\?\s*4\s*:\s*6/,
    "standard and low tiers keep dense stars crisp at their different source resolutions");
  assert.match(source, /const artComposite = new THREE[.]Mesh\(sphereGeometry, artMaterial\)/,
    "all five logical depths share one authored render pass");
  const authoredPanorama = source.slice(
    source.indexOf("const artMaterial ="),
    source.indexOf("const artLayers =")
  );
  assert.match(authoredPanorama, /new THREE[.]ShaderMaterial/,
    "the authored panorama remains one composited shader material");
  assert.doesNotMatch(authoredPanorama, /new THREE[.]MeshBasicMaterial/,
    "authored depths must not regress to five independently blended full-screen materials");
});

test("mood, effects, suspension, and disposal share one stable lifecycle", () => {
  const invalidations = [];
  const view = environment({ quality: "standard", onInvalidate: () => invalidations.push(1) });
  const colors = () => ["uVoid", "uA", "uB", "uAccent"]
    .map((name) => view.dome.material.uniforms[name].value.getHex());
  const initial = colors();
  const target = view.setMood({ worldId: "moon", destination: "arena", mode: "focused" });
  view.update(100, 0.35);
  assert.notDeepEqual(colors(), initial);
  for (let frame = 0; frame < 12; frame += 1) view.update(200 + frame * 100, 0.1);
  assert.deepEqual(colors(), target);
  const before = view.dome.material.uniforms.uTime.value;
  assert.equal(view.suspend(), true);
  assert.equal(view.update(1200, 0.1), false);
  assert.equal(view.dome.material.uniforms.uTime.value, before);
  assert.equal(view.resume(), true);
  const reduced = view.setEffects("reduced");
  assert.equal(reduced.animated, false);
  assert.equal(view.dome.material.uniforms.uIntensity.value, 0.72);
  assert.equal(view.setEffects("off").enabled, false);
  assert.equal(view.root.visible, false);
  const disposed = { noise: 0, gridTexture: 0, gridGeometry: 0, meterGeometry: 0, meterLabelGeometry: 0, carriers: 0, meters: 0 };
  view.noiseTexture.addEventListener("dispose", () => { disposed.noise += 1; });
  view.gridTexture.addEventListener("dispose", () => { disposed.gridTexture += 1; });
  view.worldGrid.geometry.addEventListener("dispose", () => { disposed.gridGeometry += 1; });
  view.planeMeters[0].ring.geometry.addEventListener("dispose", () => { disposed.meterGeometry += 1; });
  view.planeMeters[0].label.geometry.addEventListener("dispose", () => { disposed.meterLabelGeometry += 1; });
  for (const carrier of view.gridCarriers) {
    carrier.material.addEventListener("dispose", () => { disposed.carriers += 1; });
  }
  for (const meter of view.planeMeters) {
    meter.ring.material.addEventListener("dispose", () => { disposed.meters += 1; });
    meter.label.material.addEventListener("dispose", () => { disposed.meters += 1; });
  }
  assert.equal(view.dispose(), true);
  assert.equal(view.dispose(), false);
  assert.deepEqual(disposed, {
    noise: 1,
    gridTexture: 1,
    gridGeometry: 1,
    meterGeometry: 1,
    meterLabelGeometry: 1,
    carriers: 3,
    meters: 4
  });
  assert.ok(invalidations.length >= 4);
});
