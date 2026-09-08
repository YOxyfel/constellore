import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";

import {
  CELESTIAL_ATLAS_LOD_POLICY,
  createCelestialAtlas,
  resolveCelestialAtlasPresentation
} from "../public/celestial-atlas-runtime.mjs";
import {
  CELESTIAL_COSMOLOGY_DISTANCE_POLICY,
  CELESTIAL_COSMOLOGY_TRANSITIONS,
  createCelestialCosmology,
  resolveCelestialCosmologyWeights
} from "../public/celestial-cosmology-runtime.mjs";
import { createPlanetHubSpaceEnvironment } from "../public/planet-hub-space.mjs";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

function cssRules(source) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, declarations]) => ({
    selector: selector.trim(),
    declarations
  }));
}

function assertSoftPointTexture(material, label, { allowCrossfade = false } = {}) {
  const texture = material.alphaMap || material.map;
  assert.ok(texture?.isDataTexture, `${label} needs a deterministic soft DataTexture mask`);
  const { data, width, height } = texture.image || {};
  assert.ok(data instanceof Uint8Array && width >= 8 && height >= 8,
    `${label} needs a useful point-mask raster`);
  const channel = material.alphaMap ? 1 : 3;
  const sample = (x, y) => data[(y * width + x) * 4 + channel];
  const corners = [sample(0, 0), sample(width - 1, 0), sample(0, height - 1), sample(width - 1, height - 1)];
  assert.ok(Math.max(...corners) <= 8, `${label} must have transparent corners, never an opaque square`);
  assert.ok(sample(Math.floor(width / 2), Math.floor(height / 2)) >= 128,
    `${label} keeps a bright circular core after masking`);
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);
  if (allowCrossfade) {
    assert.equal(material.alphaTest, 0,
      `${label} keeps its feathered edge continuous even at a tiny crossfade weight`);
  } else {
    assert.ok(material.alphaTest > 0, `${label} rejects the compression/noise floor around the point`);
  }
}

function assertRoundPointObject(object) {
  const label = object.name || "unnamed point field";
  const material = object.material;
  if (material?.isShaderMaterial) {
    assert.match(material.fragmentShader || "", /gl_PointCoord/,
      `${label} shader must shape each GL point in point coordinates`);
    assert.match(material.fragmentShader || "", /discard|smoothstep/,
      `${label} shader must discard or feather square point corners`);
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    return;
  }
  assertSoftPointTexture(material, label);
}

test("Planet Hub canvas stays at stable CSS geometry and never requests pixel-art resampling", async () => {
  const source = await readFile(projectFile("public/planet-hub.css"), "utf8");
  const rules = cssRules(source);
  const geometryRule = rules.find(({ selector }) => (
    selector.includes(".planet-hub canvas") && selector.includes(".planet-hub__poster")
  ));
  assert.ok(geometryRule, "Planet Hub needs one shared canvas/poster geometry rule");
  assert.match(geometryRule.declarations, /\binset\s*:\s*0\s*;/);
  assert.match(geometryRule.declarations, /\bwidth\s*:\s*100%\s*;/);
  assert.match(geometryRule.declarations, /\bheight\s*:\s*100%\s*;/);
  assert.match(geometryRule.declarations, /\bdisplay\s*:\s*block\s*;/);

  const canvasDeclarations = rules
    .filter(({ selector }) => /(?:^|[\s,:>(])canvas(?:[\s,:>.)#\[]|$)/.test(selector))
    .map(({ declarations }) => declarations)
    .join("\n");
  assert.doesNotMatch(canvasDeclarations, /image-rendering\s*:\s*(?:pixelated|crisp-edges)/i,
    "the WebGL canvas must retain the browser's smooth default resampling");
  assert.doesNotMatch(canvasDeclarations, /transform\s*:\s*[^;]*scale\s*\(/i,
    "CSS must not enlarge the rendered backing store; cinematic framing belongs to the camera");
});

test("all constant-pixel star and node fields have circular feathered point masks", () => {
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 448);
  camera.position.set(0, 0.08, 4.5);
  camera.lookAt(0, -1.075, 0);
  const space = createPlanetHubSpaceEnvironment(THREE, {
    camera,
    width: 1280,
    height: 720,
    quality: "standard"
  });
  const spacePoints = [];
  space.root.traverse((object) => {
    if (object.isPoints) spacePoints.push(object);
  });
  assert.ok(spacePoints.length >= 2);
  spacePoints.forEach(assertRoundPointObject);
  space.dispose();

  const atlas = createCelestialAtlas(THREE, { quality: "standard" });
  atlas.setSemanticTier({ progress: 1 });
  const atlasPoints = [];
  atlas.root.traverse((object) => {
    if (object.isPoints && object.material?.sizeAttenuation === false) atlasPoints.push(object);
  });
  assert.ok(atlasPoints.length >= 8, "stellar, deep-sky, marker, and selection points are audited");
  atlasPoints.forEach(assertRoundPointObject);
  atlas.dispose();
});

test("cosmology impostors have transparent corners and cannot become opaque rectangular panels", () => {
  const cosmology = createCelestialCosmology(THREE, { quality: "standard" });
  for (const [tierId, record] of cosmology.tierRoots) {
    for (const object of [record.pointField, record.structureCores, record.anchors, record.filamentTrace]) {
      assertSoftPointTexture(object.material, object.name, { allowCrossfade: true });
      assert.equal(object.material.blending, THREE.AdditiveBlending,
        `${tierId}/${object.name} stays a luminous impostor instead of an opaque card`);
    }
  }
  cosmology.dispose();
});

test("Milky Way image and haze slices fade their plane edges instead of exposing billboard rectangles", () => {
  class ImmediateTextureLoader {
    load(_url, onLoad) {
      const texture = new THREE.Texture();
      onLoad(texture);
      return texture;
    }
  }
  const atlas = createCelestialAtlas({ ...THREE, TextureLoader: ImmediateTextureLoader }, {
    quality: "standard",
    galaxyTextureUrl: "https://example.test/milky-way.webp"
  });
  atlas.setSemanticTier({ progress: 1 });
  const slices = [...atlas.galaxy.textureLayers, ...atlas.galaxy.volumeLayers];
  assert.ok(slices.length >= 10, "the full image and volumetric slice stack is audited");
  for (const slice of slices) {
    const shader = slice.material.fragmentShader || "";
    assert.equal(slice.material.transparent, true, `${slice.name} must alpha blend`);
    assert.equal(slice.material.depthWrite, false, `${slice.name} cannot write an opaque plane to depth`);
    assert.match(shader, /edge|envelope|discard|smoothstep/,
      `${slice.name} must taper or discard pixels before the plane boundary`);
    assert.doesNotMatch(shader, /gl_FragColor\s*=\s*vec4\([^;]*,\s*1(?:[.]0*)?\s*\)/,
      `${slice.name} cannot force every billboard pixel opaque`);
  }
  atlas.dispose();
});

test("atlas LOD transition windows are continuous on both sides of every ownership boundary", () => {
  for (const [name, [start, end]] of Object.entries(CELESTIAL_ATLAS_LOD_POLICY.transitions)) {
    for (const boundary of [start, end]) {
      const epsilon = 1e-8;
      const before = resolveCelestialAtlasPresentation({ progress: Math.max(0, boundary - epsilon) }).weights;
      const after = resolveCelestialAtlasPresentation({ progress: Math.min(1, boundary + epsilon) }).weights;
      const jump = Object.keys(before).reduce((sum, key) => sum + Math.abs(before[key] - after[key]), 0);
      assert.ok(jump < 1e-5, `${name} has no opacity jump at ${boundary} (L1 ${jump})`);
      assert.ok(Math.abs(Object.values(before).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      assert.ok(Math.abs(Object.values(after).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
    }
  }
});

test("cosmology LOD transition windows are continuous and never activate non-neighbour roots", () => {
  const metersPerLightYear = CELESTIAL_COSMOLOGY_DISTANCE_POLICY.metersPerLightYear;
  for (const transition of CELESTIAL_COSMOLOGY_TRANSITIONS) {
    for (const boundary of [transition.startLightYears, transition.endLightYears]) {
      const epsilon = 1e-8;
      const before = resolveCelestialCosmologyWeights({
        distanceMeters: boundary * (1 - epsilon) * metersPerLightYear
      });
      const after = resolveCelestialCosmologyWeights({
        distanceMeters: boundary * (1 + epsilon) * metersPerLightYear
      });
      const jump = Object.keys(before).reduce((sum, key) => sum + Math.abs(before[key] - after[key]), 0);
      assert.ok(jump < 1e-5,
        `${transition.from}->${transition.to} has no opacity jump at ${boundary} ly (L1 ${jump})`);
      for (const weights of [before, after]) {
        const active = Object.entries(weights).filter(([, weight]) => weight > 1e-12).map(([id]) => id);
        assert.ok(active.length <= 2);
        if (active.length === 2) assert.deepEqual(active, [transition.from, transition.to]);
      }
    }
  }
});

test("the cosmic handoff retires the atlas Milky Way before Local Group glyphs take ownership", async () => {
  const source = await readFile(projectFile("public/planet-hub-renderer.mjs"), "utf8");
  const start = source.indexOf("function syncCelestialCosmologyPresentation(");
  const end = source.indexOf("async function ensureCelestialCosmology()", start);
  assert.ok(start >= 0 && end > start);
  const handoff = source.slice(start, end);
  assert.match(handoff, /celestialAtlas[\s\S]*?galaxy[\s\S]*?galaxyRoot[\s\S]*?(?:visible|opacity)/,
    "the atlas disc must be retired or crossfaded when observer-scale cosmology becomes visible");
  assert.match(handoff, /(?:active|progress)/,
    "Milky Way retirement must follow the actual cosmic handoff state");
});
