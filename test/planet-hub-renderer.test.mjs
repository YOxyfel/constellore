import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PLANET_HUB_DISTANCE_METERS,
  PLANET_HUB_ZOOM_ANCHOR_PROGRESS,
  calculatePlanetHubSemanticCameraTarget,
  planetHubCosmicZoomDistanceToProgress,
  resolvePlanetHubCosmicRepresentedDistance,
  planetHubZoomProgressToDistance
} from "../public/planet-hub-zoom.mjs";

import {
  DEFAULT_PLANET_HUB_GLTF_LOADER_URL,
  DEFAULT_PLANET_HUB_THREE_SPECIFIER,
  PACKED_PORTAL_FRAGMENT_SHADER,
  PLANET_HUB_AMBIENT_FRAME_INTERVAL_MS,
  PLANET_HUB_MOON_ORBIT_PERIOD_MS,
  PLANET_HUB_MOON_ORBIT_RADIUS,
  PLANET_HUB_MOON_RADIUS_RATIO,
  PLANET_HUB_SUN_HANDOFF_PIXELS,
  PLANET_HUB_SUN_PLACEMENT,
  PLANET_HUB_IDLE_YAW_SPEED,
  PLANET_HUB_IDLE_RESUME_DELAY_MS,
  PLANET_HUB_COAST_MAX_MS,
  PLANET_HUB_COAST_MIN_MS,
  PLANET_HUB_THROW_MAX_ANGULAR_SPEED,
  PLANET_HUB_THROW_MAX_MULTIPLIER,
  PLANET_HUB_ANGULAR_SPEED_CAPS,
  PLANET_HUB_JOURNEY_APPROACH_START_MS,
  PLANET_HUB_JOURNEY_BODY_CLEARANCE,
  PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS,
  PLANET_HUB_JOURNEY_DURATION_MS,
  PLANET_HUB_JOURNEY_HERO_ARC_RADIANS,
  PLANET_HUB_JOURNEY_IGNITION_MS,
  PLANET_HUB_JOURNEY_LANDING_CAMERA_BLEND_MS,
  PLANET_HUB_JOURNEY_LANDING_CAMERA_START_MS,
  PLANET_HUB_JOURNEY_LANDING_START_MS,
  PLANET_HUB_JOURNEY_LANDING_STATIC_MS,
  PLANET_HUB_JOURNEY_LAUNCH_LIFT_HEIGHT,
  PLANET_HUB_JOURNEY_LAUNCH_LIFT_MS,
  PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS,
  PLANET_HUB_JOURNEY_OUTBOUND_ORBIT_END_MS,
  PLANET_HUB_JOURNEY_RETURN_HANDOFF_END_MS,
  PLANET_HUB_JOURNEY_ROUTE_STRETCH,
  PLANET_HUB_JOURNEY_VEHICLE_RADIUS_RATIO,
  PLANET_HUB_ENGINE_PLUME_FRAGMENT_SHADER,
  PLANET_HUB_ENGINE_PLUME_VERTEX_SHADER,
  calculatePlanetHubCameraDistance,
  calculatePlanetHubChartBodyDisplayScale,
  calculatePlanetHubProjectedBodyDiameterPixels,
  calculatePlanetHubProxyHandoff,
  calculatePlanetHubCameraFacingSphereSamples,
  calculatePlanetHubCameraOrbitPose,
  calculatePlanetHubCelestialLayout,
  calculatePlanetHubFlightPhase,
  calculatePlanetHubHoverFocus,
  calculatePlanetHubJourneyCameraPose,
  calculatePlanetHubJourneyDeparturePose,
  calculatePlanetHubJourneyRocketUp,
  calculatePlanetHubVehicleSphereClearance,
  calculatePlanetHubMoonLandingGeometry,
  calculatePlanetHubSurfaceLandingGeometry,
  calculatePlanetHubTransportedFrame,
  calculatePlanetHubDragRelease,
  calculatePlanetHubDragRotation,
  calculatePlanetHubReleaseDirection,
  calculatePlanetHubCoastDuration,
  calculatePlanetHubFocusFraming,
  calculatePlanetHubPresentationDuration,
  calculatePlanetHubPresentationScale,
  calculatePlanetHubRocketDock,
  calculatePlanetHubReducedMotionSatellitePosition,
  calculatePlanetHubSatellitePerspectiveScale,
  calculatePlanetHubSatellitePose,
  calculatePlanetHubSunPresentation,
  calculatePlanetHubSunRotation,
  applyPlanetHubVisualRotationToCameraOrbit,
  configurePlanetHubSurfaceTexture,
  constrainPlanetHubCameraOrbitForView,
  constrainPlanetHubCameraOutsideSphere,
  createPlanetHubEnginePlumeMaterial,
  createPlanetHubNightLightsMaterial,
  createPlanetHubPlanetMaterial,
  createPlanetHubDiagnostics,
  createPlanetHubCameraOrbitState,
  createPlanetHubSunSurfaceMaterial,
  createPackedPortalMaterial,
  disposePlanetHubWebGLRenderer,
  easePlanetHubPresentationProgress,
  interpolatePlanetHubCameraOrbitState,
  loadPlanetHubThree,
  resolvePlanetHubRaycastDetail,
  resolvePlanetHubRaycastTarget,
  resolvePlanetHubCinematicLighting,
  resolvePlanetHubJourneyPresentation,
  resolvePlanetHubAngularScale,
  resolvePlanetHubSunOptics,
  resolvePlanetHubSunLod,
  resolvePlanetHubPrecisionFrustum,
  rescalePlanetHubAngularVelocity,
  shouldPlanetHubCoastOwnInput,
  shouldRenderPlanetHubFrame,
  smoothPlanetHubCameraPose,
  stepPlanetHubFrontActivation,
  stepPlanetHubIdleState,
  stepPlanetHubRotation,
  updatePlanetHubEnginePlumeMaterial
} from "../public/planet-hub-renderer.mjs";
import { calculatePlanetHubPivotHandoffOrbit } from "../public/planet-hub-space.mjs";

test("the physical Sun keeps one immutable chart coordinate and radius across every semantic tier", () => {
  const atlasPosition = [-2.002874, 0, 11.41766];
  const { orbit, system: systemAnchor } = PLANET_HUB_ZOOM_ANCHOR_PROGRESS;
  const near = calculatePlanetHubSunPresentation({ progress: orbit, atlasPosition, chartRadius: 2.6 });
  const planet = calculatePlanetHubSunPresentation({ progress: orbit * 0.5, atlasPosition, chartRadius: 2.6 });
  const middle = calculatePlanetHubSunPresentation({ progress: (orbit + systemAnchor) * 0.5, atlasPosition, chartRadius: 2.6 });
  const system = calculatePlanetHubSunPresentation({ progress: systemAnchor, atlasPosition, chartRadius: 2.6 });
  assert.deepEqual(near.position, atlasPosition);
  assert.deepEqual(planet, near, "Planet keeps one stable distant-light presentation");
  assert.deepEqual(system.position, atlasPosition);
  assert.equal(near.radius, 2.6);
  assert.equal(system.radius, 2.6);
  assert.equal(middle.radius, 2.6);
  assert.equal(near.chartBlend, 1);
  assert.equal(system.chartBlend, 1);
  let previousRadius = near.radius;
  for (let step = 1; step <= 190; step += 1) {
    const presentation = calculatePlanetHubSunPresentation({
      progress: orbit + (systemAnchor - orbit) * step / 190,
      atlasPosition,
      chartRadius: 2.6
    });
    assert.deepEqual(presentation.position, atlasPosition);
    assert.equal(presentation.radius, previousRadius,
      "semantic progress cannot animate the physical solar radius");
    previousRadius = presentation.radius;
  }
});

test("dense semantic progress keeps the rendered Sun, chart centre, and camera pivot continuous", () => {
  const atlasPosition = [-2.002874, 0, 11.41766];
  const maximumSmoothTargetStep = Math.hypot(...atlasPosition) * 0.05;
  let previousSun = null;
  let previousTarget = null;
  for (let step = 0; step <= 1000; step += 1) {
    const progress = step / 1000;
    const presentation = calculatePlanetHubSunPresentation({ progress, atlasPosition, chartRadius: 2.6 });
    const target = calculatePlanetHubSemanticCameraTarget({
      progress,
      worldPosition: [0, 0, 0],
      earthPosition: [0, 0, 0],
      sunPosition: presentation.position,
      galacticCenterPosition: atlasPosition
    });
    assert.ok(presentation.position.every(Number.isFinite));
    assert.ok(target.every(Number.isFinite));
    assert.deepEqual(presentation.position, atlasPosition,
      `zoom progress ${progress.toFixed(3)} cannot detach the rendered Sun from its atlas paths`);
    assert.equal(presentation.chartBlend, 1);
    assert.equal(presentation.radius, 2.6);
    if (previousSun) {
      assert.deepEqual(presentation.position, previousSun,
        `the physical Sun cannot migrate at ${progress.toFixed(3)}`);
      assert.ok(Math.hypot(...target.map((value, axis) => value - previousTarget[axis])) < maximumSmoothTargetStep,
        `semantic camera target jumped at ${progress.toFixed(3)}`);
    }
    previousSun = presentation.position;
    previousTarget = target;
  }
});

test("runtime selected Earth owns every legacy camera sample and bypasses the automatic Sun arc", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const semanticStart = source.indexOf("function semanticCameraTarget(");
  const overviewStart = source.indexOf("function overviewOrbitWithViewZoom(", semanticStart);
  const overviewEnd = source.indexOf("function orbitWithViewZoom(", overviewStart);
  assert.ok(semanticStart >= 0 && overviewStart > semanticStart && overviewEnd > overviewStart);
  const semantic = source.slice(semanticStart, overviewStart);
  const overview = source.slice(overviewStart, overviewEnd);
  assert.match(semantic,
    /semanticSubjectId\s*=\s*bodyFocusId\s*\|\|\s*selectedBodyId\s*\|\|\s*orbitBodyId\s*\|\|\s*worldId[\s\S]*selectedBodyPosition\s*=\s*semanticSubjectId[\s\S]*vector\(semanticSubjectId,\s*earthPosition\)/,
    "the reset-selected Earth is a camera subject, not merely a highlighted mesh");
  assert.doesNotMatch(overview, /calculatePivotHandoffOrbit|semanticZoomReferenceOrbit/,
    "the selected body is the only overview pivot; no hidden Sun arc can move it");

  const earth = [0, 0, 0];
  for (let sample = 0; sample <= 1600; sample += 1) {
    const progress = PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system * sample / 1600;
    assert.deepEqual(calculatePlanetHubSemanticCameraTarget({
      progress,
      earthPosition: earth,
      sunPosition: [-2.002874, 0, 11.41766],
      selectedBodyPosition: earth
    }), earth, `selected Earth stays exact through System sample ${sample}`);
  }
});

test("authored and physical Earth-Moon handoffs are complementary and reversible", () => {
  const handoffEnd = (PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit
    + PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system) * 0.5;
  const handoffStart = handoffEnd - 0.035;
  assert.ok(Math.abs(planetHubZoomProgressToDistance(handoffStart) / 3_420_321_543 - 1) < 1e-9);
  assert.ok(Math.abs(planetHubZoomProgressToDistance(handoffEnd) / 10_724_310_840 - 1) < 1e-9);
  const closeEarthRadius = 1;
  const physicalEarthRadius = 2.25;
  const closeMoonRadius = PLANET_HUB_MOON_RADIUS_RATIO;
  const physicalMoonRadius = closeMoonRadius * 2.25;
  const samples = Array.from({ length: 1001 }, (_, index) => index / 1000);
  const forward = samples.map((blend) => ({
    earth: calculatePlanetHubProxyHandoff({
      blend, authoredRadius: closeEarthRadius, proxyRadius: physicalEarthRadius
    }),
    moon: calculatePlanetHubProxyHandoff({
      blend, authoredRadius: closeMoonRadius, proxyRadius: physicalMoonRadius
    })
  }));
  const reverse = [...samples].reverse().map((blend) => calculatePlanetHubProxyHandoff({
    blend, authoredRadius: closeEarthRadius, proxyRadius: physicalEarthRadius
  })).reverse();
  for (let index = 0; index < forward.length; index += 1) {
    const { earth, moon } = forward[index];
    assert.ok(Math.abs(earth.authoredOpacity + earth.proxyOpacity - 1) < 1e-12);
    assert.ok(Math.abs(moon.authoredOpacity + moon.proxyOpacity - 1) < 1e-12);
    assert.ok(Math.abs(earth.radius - reverse[index].radius) < 1e-12,
      `reverse radius mismatch at ${index}`);
    assert.ok(Math.abs(moon.radius / earth.radius - closeMoonRadius) < 1e-12,
      `Earth and Moon must share one radius morph at ${index}`);
  }
  assert.equal(forward[0].earth.radius, closeEarthRadius);
  assert.equal(forward.at(-1).earth.radius, physicalEarthRadius);
});

test("world-space Moon sizing and focused camera fits cancel dense rebases in both directions", () => {
  const scales = Array.from({ length: 401 }, (_, index) => 2 ** ((index - 200) / 25));
  for (const sequence of [scales, [...scales].reverse()]) {
    for (const rootScale of sequence) {
      const earthScale = rootScale;
      const earthDistance = 4.5 * rootScale;
      const moonDistance = 4.9 * rootScale;
      const localMoonScale = calculatePlanetHubSatellitePerspectiveScale({
        baseScale: PLANET_HUB_MOON_RADIUS_RATIO,
        earthScale,
        earthCameraDistance: earthDistance,
        satelliteCameraDistance: moonDistance
      }) / rootScale;
      assert.ok(Math.abs(localMoonScale
        - PLANET_HUB_MOON_RADIUS_RATIO * moonDistance / earthDistance) < 1e-12);
      const focusedWorldRadius = 0.1363 * rootScale;
      const fittedCameraRadius = focusedWorldRadius * 2.7;
      assert.ok(Math.abs(fittedCameraRadius / focusedWorldRadius - 2.7) < 1e-12,
        `live focus fit changed at rebase scale ${rootScale}`);
    }
  }
});

test("cosmic precision rebases preserve projection and clipping forward and reverse", () => {
  const seamsMly = [0.876664, 3.769494, 16.208135, 69.692015];
  const seams = seamsMly.map((expectedMly, index) => {
    const distanceMeters = PLANET_HUB_DISTANCE_METERS.lightYear
      * 203884 * 1.2 ** ((index + 1) * 8);
    assert.ok(Math.abs(distanceMeters / PLANET_HUB_DISTANCE_METERS.lightYear / 1e6
      - expectedMly) < 5e-7);
    const around = [1 - 1e-7, 1 + 1e-7].map((side) => (
      resolvePlanetHubCosmicRepresentedDistance(
        planetHubCosmicZoomDistanceToProgress(distanceMeters * side)
      )
    ));
    assert.deepEqual(around.map(({ rebaseIndex }) => rebaseIndex), [index, index + 1]);
    return { distanceMeters, around };
  });

  for (const sequence of [seams, [...seams].reverse()]) {
    for (const { distanceMeters, around } of sequence) {
      for (const direction of [around, [...around].reverse()]) {
        let projected = null;
        for (const represented of direction) {
          const localDollyFactor = distanceMeters / represented.metersPerUnit;
          const frustum = resolvePlanetHubPrecisionFrustum({ localDollyFactor });
          const depths = [0.049, 0.051, 12, 447, 449]
            .map((ratio) => ratio * distanceMeters / represented.metersPerUnit);
          assert.deepEqual(depths.map((depth) => depth >= frustum.near && depth <= frustum.far),
            [false, true, true, true, false]);
          const pointDepth = 12 * distanceMeters / represented.metersPerUnit;
          const pointX = 3 * distanceMeters / represented.metersPerUnit;
          const ndc = [
            pointX / pointDepth,
            (frustum.far + frustum.near) / (frustum.far - frustum.near)
              - 2 * frustum.far * frustum.near
                / (frustum.far - frustum.near) / pointDepth
          ];
          if (projected) assert.ok(ndc.every((value, axis) => Math.abs(value - projected[axis]) < 1e-12));
          projected = ndc;
        }
      }
    }
  }
});

test("dense physical-distance sweeps have inverse-distance projection, no diameter floor, and symmetric Sun ownership", () => {
  const physicalWorldRadius = 1;
  const distances = Array.from({ length: 2401 }, (_, index) => (
    32 * Math.exp(Math.log(200_000 / 32) * index / 2400)
  ));
  const outward = distances.map((cameraDistance) => resolvePlanetHubSunLod({
    physicalWorldRadius,
    cameraDistance,
    verticalFovDegrees: 42,
    viewportHeight: 900,
    progress: 0.44
  }));
  const inward = [...distances].reverse().map((cameraDistance) => resolvePlanetHubSunLod({
    physicalWorldRadius,
    cameraDistance,
    verticalFovDegrees: 42,
    viewportHeight: 900,
    progress: 0.44
  })).reverse();

  let sawModel = false, sawCrossfade = false, sawParticle = false;
  for (let index = 0; index < outward.length; index += 1) {
    const sample = outward[index];
    const reverse = inward[index];
    assert.equal(sample.mode, reverse.mode);
    for (const key of ["projectedDiameterPixels", "modelOpacity", "particleOpacity", "glareOpacity"]) {
      assert.ok(Math.abs(sample[key] - reverse[key]) < 1e-12,
        `${key} is independent of travel direction at sample ${index}`);
    }
    assert.ok(Math.abs(sample.modelOpacity + sample.particleOpacity - 1) < 1e-12);
    assert.ok(sample.glareDiameterPixels <= sample.projectedDiameterPixels + 1e-12);
    sawModel ||= sample.mode === "model";
    sawCrossfade ||= sample.mode === "model-particle";
    sawParticle ||= sample.mode === "particle";
    if (index === 0) continue;
    assert.ok(sample.projectedDiameterPixels < outward[index - 1].projectedDiameterPixels,
      `solid diameter has no plateau or minimum at sample ${index}`);
    assert.ok(sample.modelOpacity <= outward[index - 1].modelOpacity + 1e-12);
    assert.ok(sample.particleOpacity >= outward[index - 1].particleOpacity - 1e-12);
  }
  assert.ok(sawModel && sawCrossfade && sawParticle,
    "the sweep crosses Model -> ModelAndParticle -> Particle");

  for (const distance of [1_000, 10_000, 100_000]) {
    const near = calculatePlanetHubProjectedBodyDiameterPixels({
      physicalWorldRadius, cameraDistance: distance, verticalFovDegrees: 42, viewportHeight: 900
    });
    const far = calculatePlanetHubProjectedBodyDiameterPixels({
      physicalWorldRadius, cameraDistance: distance * 2, verticalFovDegrees: 42, viewportHeight: 900
    });
    assert.ok(Math.abs(far / near - 0.5) < 1e-6,
      `doubling far-field distance halves physical diameter at ${distance}`);
  }
  assert.deepEqual(PLANET_HUB_SUN_HANDOFF_PIXELS, { particleOnly: 0.55, modelOnly: 1.75 });
});

test("the local and atlas additive points form one continuous distant-Sun owner", async () => {
  const { resolveCelestialAtlasPresentation } = await import("../public/celestial-atlas-runtime.mjs");
  for (let index = 0; index <= 1000; index += 1) {
    const progress = 0.54 + index / 1000 * 0.14;
    const atlas = resolveCelestialAtlasPresentation({ progress });
    const lod = resolvePlanetHubSunLod({
      physicalWorldRadius: 1,
      cameraDistance: 1_000_000,
      verticalFovDegrees: 42,
      viewportHeight: 900,
      progress
    });
    assert.equal(lod.mode, "particle");
    const localPoint = lod.particleOpacity * atlas.solarDetailOpacity;
    const atlasPoint = atlas.solarMarkerOpacity;
    assert.ok(Math.abs(localPoint + atlasPoint - 1) < 1e-12,
      `exactly one additive point survives the solar-detail handoff at ${progress.toFixed(5)}`);
  }
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const diagnosticsSource = await readFile(new URL("../public/celestial-atlas-runtime.mjs", import.meta.url), "utf8");
  assert.match(source, /effectiveParticleOpacity\s*=\s*Math[.]max\(0,\s*Math[.]min\(1,[\s\S]*particleOpacity\s*\+\s*atlasParticleOpacity/);
  assert.match(diagnosticsSource, /planetHubSunParticleOwner:\s*sunEffectiveLod[.]particleOwner/,
    "diagnostics publish the effective rendered point owner rather than nominal local LOD");
});

test("renderer rebases astronomical distance without rebasing semantic ownership", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const scaleStart = source.indexOf("function syncScaleSpace(");
  const visibilityStart = source.indexOf("function isCelestialBodyVisibleInBand(", scaleStart);
  const scaleSpace = source.slice(scaleStart, visibilityStart);
  assert.ok(scaleStart >= 0 && visibilityStart > scaleStart,
    "the renderer exposes one auditable physical-to-local rebase seam");
  assert.match(scaleSpace,
    /resolvePlanetHubRepresentedDistance\(progress,\s*zoomBounds\)/);
  assert.match(scaleSpace,
    /resolvePlanetHubCosmicRepresentedDistance\(cosmicProgress\)/,
    "the extension keeps the same precision-safe rebase contract beyond the Milky Way");
  assert.match(scaleSpace,
    /celestialSystem[.]scale[.]setScalar\(\s*PLANET_HUB_DISTANCE_STOPS[.]planet\s*\*\s*zoomBounds[.]minRadius\s*\/\s*representedDistance[.]metersPerUnit\s*\)/,
    "the physical atlas root cancels the camera baseline while using the same planet-base metres as every rebase cell");
  assert.match(scaleSpace,
    /authoredCloseSystem[.]scale[.]setScalar\(\s*PLANET_HUB_DISTANCE_STOPS[.]planet\s*\/\s*representedDistance[.]metersPerUnit\s*\)/,
    "authored Earth and Moon cancel the same camera rebase instead of changing angular size every eighth pulse");
  assert.match(scaleSpace,
    /return\s+zoomBounds[.]minRadius\s*\*\s*syncScaleSpace\(progress,\s*cosmicProgress\)[.]localDollyFactor/,
    "the render camera stays precision-safe by dollying only inside the active rebase cell");

  assert.match(source,
    /const authoredCloseSystem = new THREE[.]Group\(\)[\s\S]*authoredCloseSystem[.]add\(world\)[\s\S]*authoredCloseSystem[.]add\(satelliteRoot\)/,
    "the close Earth and Moon retain their independent root while sharing its reciprocal precision scale");
  assert.doesNotMatch(source, /celestialSystem[.]add\(world\)/,
    "the authored close globe is never scaled by the physical atlas root");

  const publishStart = source.indexOf("function publishViewZoom(", visibilityStart);
  const publishEnd = source.indexOf("function recalculateZoomBounds(", publishStart);
  const publish = source.slice(publishStart, publishEnd);
  assert.ok(publishStart >= 0 && publishEnd > publishStart);
  assert.match(publish,
    /classifyPlanetHubViewBand\(\{\s*progress:\s*viewZoom[.]progress,\s*bounds:\s*zoomBounds\s*\}\)/,
    "LOD band ownership follows the continuous physical progress, never the saw-tooth local camera radius");
  assert.doesNotMatch(publish,
    /classifyPlanetHubViewBand\(\{[^}]*\bradius\b/,
    "a local rebase pulse cannot make the UI or atlas jump backward a tier");
  assert.match(publish,
    /planetHubDistanceMeters\s*=\s*representedDistance[.]distanceMeters[.]toExponential/,
    "live canvas diagnostics publish represented physical distance");
  assert.match(publish,
    /onViewChange\(Object[.]freeze\(\{[\s\S]*distanceMeters:\s*representedDistance[.]distanceMeters,[\s\S]*metersPerUnit:\s*representedDistance[.]metersPerUnit,[\s\S]*localDollyFactor:\s*representedDistance[.]localDollyFactor/,
    "runtime diagnostics receive physical distance and both halves of the rebase projection");
});

test("renderer navigation keeps one scale owner and preserves queued cross-segment travel", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const section = (startToken, endToken) => {
    const start = source.indexOf(startToken);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(start >= 0 && end > start, `${startToken} has an auditable implementation seam`);
    return source.slice(start, end);
  };

  const targetResolution = section("function resolveNavigationTarget(", "function solarNavigationPlaces(");
  assert.match(targetResolution, /isCosmicZoomActive\(\)\s*\?\s*cosmicTarget\s*\|\|\s*atlasTarget\s*:\s*atlasTarget\s*\|\|\s*cosmicTarget/,
    "outer scales resolve a colliding target through cosmology before the local atlas");

  const navigationContext = section("function getNavigationContext(", "function selectPlace(");
  assert.match(navigationContext, /const cosmicPlaces = cosmicActive\s*\?\s*celestialCosmology/,
    "a loaded cosmology cannot leak outer destinations into a legacy scale");
  assert.match(navigationContext, /tierId:\s*cosmicZoom[.]tier/,
    "cosmic Places remain contextual to the currently visible tier");

  const selection = section("function selectPlace(", "function activeNavigationFocusId(");
  assert.match(selection, /Boolean\(body\s*&&\s*navigationSelectBody\(id\)\)\s*\|\|\s*bodyMetadata[.]selectable\s*!==\s*false/,
    "Places may select a solar destination before its scale-specific 3D proxy becomes interactive");
  assert.match(selection, /if \(cosmicOwner\)\s*{[\s\S]*celestialAtlas[?][.]setSelectedPlace[?][.]\(null\);[\s\S]*celestialCosmology[?][.]setSelectedPlace[?][.]\(id\)/);
  assert.match(selection, /else\s*{[\s\S]*celestialCosmology[?][.]setSelectedPlace[?][.]\(null\);[\s\S]*celestialAtlas[?][.]setSelectedPlace[?][.]\(id\)/,
    "selecting either owner explicitly clears the stale selection marker in the other owner");
  assert.match(source, /navigationSelectBody\s*=\s*setSelectedBody;[\s\S]*navigationFocusBody\s*=\s*setCelestialBodyFocus;[\s\S]*navigationSetOrbitBody\s*=\s*setOrbitBody;[\s\S]*navigationSetViewZoom\s*=\s*setViewZoom;[\s\S]*navigationSetCosmicZoom\s*=\s*setCosmicZoom;/,
    "navigation delegates cross the guarded renderer-construction block without unresolved lexical names");

  const selectedBody = section("function setSelectedBody(", "function setCelestialBodyFocus(");
  assert.match(selectedBody, /selectedPlaceId\s*=\s*record[.]id/);
  assert.match(selectedBody, /celestialCosmology[?][.]setSelectedPlace[?][.]\(null\)/,
    "solar selection synchronizes the Places id and clears cosmology");

  const bodyFocus = section("function setCelestialBodyFocus(", "function clearCelestialBodyFocus(");
  assert.match(bodyFocus, /bodyFocusId\s*=\s*record[.]id;[\s\S]*placeFocusId\s*=\s*null;[\s\S]*placeFocusCloseRadius\s*=\s*null/,
    "body focus cannot coexist with an old generic place focus");

  const visitQueue = section("function queuePlaceVisitFocus(", "function visitPlace(");
  const currentWorldBranch = visitQueue.indexOf("target.canonicalId === worldId");
  const savedStateReset = visitQueue.indexOf("placeSavedNavigationState = null", currentWorldBranch);
  const homeVisit = visitQueue.indexOf("navigationSetOrbitBody(worldId", currentWorldBranch);
  assert.ok(currentWorldBranch >= 0 && savedStateReset > currentWorldBranch && homeVisit > savedStateReset,
    "an explicit Home visit discards generic return state before changing the orbit owner");

  const visit = section("function visitPlace(", "function restoreNavigationState(");
  assert.match(visit,
    /resolved[.]kind\s*!==\s*["']solar-body["']\s*&&\s*resolved[.]available\s*===\s*false/,
    "astronomy Visits remain enabled for every selectable planet even when gameplay marks it FUTURE");

  const cosmologyLoad = section("async function ensureCelestialCosmology(", "function publishPhysicalDiagnostics(");
  assert.match(cosmologyLoad, /syncCelestialCosmologyPresentation\(\);[\s\S]*publishViewZoom\(\{ force: true \}\);[\s\S]*requestRenderAcrossConstruction\(\)/,
    "async cosmology readiness immediately republishes navigation and view state");
  assert.match(cosmologyLoad,
    /createCelestialCosmology\(THREE,\s*\{[\s\S]*effectsLevel:\s*currentEffectsLevel[\s\S]*devicePixelRatio:/,
    "the lazy cosmology receives the live cinematic quality policy when constructed");
  const cosmologyPresentation = section("function syncCelestialCosmologyPresentation(", "async function ensureCelestialCosmology(");
  assert.match(cosmologyPresentation,
    /resolveCelestialCosmologyEntryOpacity[?][.]\(\{[\s\S]*distanceMeters:\s*representedDistance[.]distanceMeters[\s\S]*const cosmicFade\s*=\s*1\s*-\s*cosmicOpacity/,
    "the Milky Way handoff follows represented physical distance instead of an arbitrary progress notch");
  assert.match(cosmologyPresentation,
    /setWorldGridTransitionOpacity[?][.]\(cosmicFade\)/,
    "the native measuring grid recedes through the same continuous physical handoff as the Milky Way");
  assert.match(cosmologyPresentation,
    /solarMarkerLabel[)]?\s*[{\s\S]*solarMarkerLabel[.]visible\s*=\s*false/,
    "the SUN chart label retires once the Milky Way becomes the navigable cosmic object");
  assert.match(cosmologyPresentation,
    /solarMarker[)]?\s*[{\s\S]*solarMarker[.]visible\s*=\s*false/,
    "the solar-system point retires once a cosmic Milky Way glyph owns the same origin");

  const diagnostics = section("function publishPhysicalDiagnostics(", "function publishViewZoom(");
  assert.match(diagnostics, /celestialAtlasModule[?][.]publishPlanetHubPhysicalDiagnostics[?][.]\(/,
    "query-only physical diagnostics are delegated to the already-lazy atlas module");
  assert.match(diagnostics, /celestialCosmologyPresentation,\s*spaceEnvironment/,
    "the lazy diagnostic delegate receives active atlas and outer-universe state");

  const viewZoom = section("function getViewZoom(", "function getViewInteractionRules(");
  assert.match(viewZoom, /pendingSegmentZoom[?][.]segment === "cosmic"[\s\S]*pendingSegmentZoom[.]progress\s*:\s*cosmicZoom[.]targetProgress/);
  assert.match(viewZoom, /pendingSegmentZoom[?][.]segment === "legacy"[\s\S]*pendingSegmentZoom[.]progress\s*:\s*viewZoom[.]targetProgress/,
    "rapid wheel notches compose from the queued destination during a segment handoff");
  const renderFrame = section("function renderFrame(", "function requestRender(");
  assert.match(renderFrame,
    /legacyZoomPending[\s\S]*pendingSegmentZoom[?][.]segment\s*===\s*"cosmic"[\s\S]*cosmicZoomPending[\s\S]*pendingSegmentZoom[?][.]segment\s*===\s*"legacy"/,
    "a queued cross-segment target keeps RAF alive until the source spring reaches the exact drain threshold");

  const publicApiStart = source.lastIndexOf("return Object.freeze({");
  const publicApiEnd = source.indexOf("\n  });\n  } catch", publicApiStart);
  assert.ok(publicApiStart >= 0 && publicApiEnd > publicApiStart,
    "renderer public API has an auditable implementation seam");
  const publicApi = source.slice(publicApiStart, publicApiEnd);
  for (const method of [
    "setCosmicZoom", "getNavigationContext", "selectPlace", "visitPlace",
    "captureNavigationState", "restoreNavigationState", "getViewZoom"
  ]) assert.match(publicApi, new RegExp(`\\b${method}\\b`), `${method} remains public`);
});

test("Sun radius is semantic-tier invariant while chart horizon thresholds remain physical", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const sunStart = source.indexOf("export function calculatePlanetHubSunPresentation(");
  const sunEnd = source.indexOf("export function calculatePlanetHubChartBodyDisplayScale(", sunStart);
  const sun = source.slice(sunStart, sunEnd);
  assert.doesNotMatch(sun, /PLANET_HUB_ZOOM_ANCHOR_PROGRESS/,
    "semantic thresholds cannot animate a physical solar radius");
  assert.match(sun, /radius:\s*Math[.]max\(0,\s*Number\(chartRadius\)/);

  const horizonStart = source.indexOf("export function constrainPlanetHubCameraOrbitForView(");
  const horizonEnd = source.indexOf("export function calculatePlanetHubFocusedNormal(", horizonStart);
  const horizon = source.slice(horizonStart, horizonEnd);
  assert.match(horizon, /PLANET_HUB_ZOOM_ANCHOR_PROGRESS[.]orbit\s*\*\s*0[.]2/,
    "horizon acquisition starts as a fraction of the physical Orbit anchor");
  assert.match(horizon, /PLANET_HUB_ZOOM_ANCHOR_PROGRESS[.]orbit\s*\*\s*0[.]5/,
    "the chart levels before the physical Orbit anchor owns its grid");
  assert.doesNotMatch(horizon, /(?:const\s+start\s*=\s*0[.]16|amount\s*-\s*0[.]32)/,
    "horizon comfort cannot drift from the logarithmic distance model");
});

test("destination presentation never teleports an in-flight astronomical zoom", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function startPresentationTransition(");
  const end = source.indexOf("function reframeCelestialBodyFocus(", start);
  const transition = source.slice(start, end);
  assert.doesNotMatch(transition, /viewZoom[.]progress\s*=\s*viewZoom[.]targetProgress/);
  assert.doesNotMatch(transition, /viewZoom[.]velocity\s*=\s*0/);
});

test("Galaxy angular and Sun-optics tiers remain explicitly calmer than System and Universe is calmest", async () => {
  assert.ok(resolvePlanetHubAngularScale("system") > resolvePlanetHubAngularScale("galaxy"));
  assert.ok(resolvePlanetHubAngularScale("galaxy") > resolvePlanetHubAngularScale("universe"));
  assert.ok(PLANET_HUB_ANGULAR_SPEED_CAPS.system > PLANET_HUB_ANGULAR_SPEED_CAPS.galaxy);
  assert.ok(PLANET_HUB_ANGULAR_SPEED_CAPS.galaxy > PLANET_HUB_ANGULAR_SPEED_CAPS.universe);
  const optics = [
    PLANET_HUB_ZOOM_ANCHOR_PROGRESS.planet,
    PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit,
    PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system,
    PLANET_HUB_ZOOM_ANCHOR_PROGRESS.galaxy,
    PLANET_HUB_ZOOM_ANCHOR_PROGRESS.universe
  ].map(resolvePlanetHubSunOptics);
  assert.deepEqual(optics, [
    { scale: 1, opacity: 1 },
    { scale: 0.9, opacity: 0.86 },
    { scale: 0.72, opacity: 0.68 },
    { scale: 0.12, opacity: 0.18000000000000005 },
    { scale: 0, opacity: 0 }
  ]);
  for (let step = 1; step <= 100; step += 1) {
    const before = resolvePlanetHubSunOptics((step - 1) / 100);
    const after = resolvePlanetHubSunOptics(step / 100);
    assert.ok(after.scale <= before.scale && after.opacity <= before.opacity,
      "optics must recede continuously instead of popping at semantic band boundaries");
  }
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  assert.match(source, /syncSunPresentation\(viewZoom[.]progress\)/,
    "every published view update applies the continuous Sun presentation before projection");
});

test("ambient frames are capped at 30fps while direct interaction remains full-rate", () => {
  const lastRenderedAt = 1000;
  assert.equal(shouldRenderPlanetHubFrame({
    nowMs: lastRenderedAt + PLANET_HUB_AMBIENT_FRAME_INTERVAL_MS - 0.01,
    lastRenderedAt
  }), false);
  assert.equal(shouldRenderPlanetHubFrame({
    nowMs: lastRenderedAt + PLANET_HUB_AMBIENT_FRAME_INTERVAL_MS + 0.01,
    lastRenderedAt
  }), true);
  assert.equal(shouldRenderPlanetHubFrame({
    nowMs: lastRenderedAt + 1,
    lastRenderedAt,
    interactive: true
  }), true);
  assert.equal(shouldRenderPlanetHubFrame({ nowMs: 10, lastRenderedAt: 0 }), true);
});

test("cinematic lighting keeps a motivated key and preserves real shadow values", () => {
  const low = resolvePlanetHubCinematicLighting({ quality: "low" });
  const standard = resolvePlanetHubCinematicLighting({ quality: "standard" });
  for (const profile of [low, standard]) {
    assert.ok(profile.exposure < 1, "ACES exposure should preserve highlights instead of bleaching them");
    assert.ok(profile.ambient <= 0.04, "ambient fill cannot flatten the complete scene");
    assert.ok(profile.hemisphere < 0.5, "night-side values remain meaningfully darker than sunlight");
    assert.ok(profile.key > profile.fill * 7, "one motivated sunlight key owns the value structure");
    assert.ok(profile.rim < profile.key * 0.25, "rim light separates silhouettes without becoming another key");
  }
  assert.ok(standard.engine > low.engine, "standard quality earns a stronger reactive engine-light pool");
});

test("per-frame diagnostics are an explicit opt-in", () => {
  const canvas = { dataset: { retained: "yes" } };
  const disabled = createPlanetHubDiagnostics(canvas);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.set("planetHubWorldQuaternion", "1,2,3,4"), false);
  assert.equal(disabled.remove("retained"), false);
  assert.deepEqual(canvas.dataset, { retained: "yes" });

  const enabled = createPlanetHubDiagnostics(canvas, { enabled: true });
  assert.equal(enabled.set("planetHubWorldQuaternion", "1,2,3,4"), true);
  assert.equal(canvas.dataset.planetHubWorldQuaternion, "1,2,3,4");
  assert.equal(enabled.remove("planetHubWorldQuaternion"), true);
  assert.equal(canvas.dataset.planetHubWorldQuaternion, undefined);
});

test("renderer disposal releases the WebGL context after Three.js resources", () => {
  const calls = [];
  const renderer = {
    dispose: () => calls.push("dispose"),
    forceContextLoss: () => calls.push("force-context-loss")
  };
  assert.equal(disposePlanetHubWebGLRenderer(renderer), true);
  assert.deepEqual(calls, ["dispose", "force-context-loss"]);
  assert.equal(disposePlanetHubWebGLRenderer(null), false);
});

test("the production frame loop never publishes diagnostics through raw dataset writes", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function renderFrame(");
  const end = source.indexOf("function requestRender(", start);
  assert.ok(start >= 0 && end > start);
  const frameLoop = source.slice(start, end);
  assert.doesNotMatch(frameLoop, /canvas[?]?[.]dataset|canvas[.]dataset/);
  assert.match(frameLoop, /shouldRenderPlanetHubFrame/);
  assert.doesNotMatch(frameLoop, /frameDiagnostics[.]set/);
});

test("an early space invalidation cannot render through an uninitialized atmosphere", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const stateAt = source.indexOf("let atmosphereMaterial = null;");
  const firstAwaitAt = source.indexOf("await loadGltf(");
  const assignmentAt = source.indexOf("atmosphereMaterial = new THREE.ShaderMaterial(");
  const moodAt = source.indexOf("function applyCinematicMood(");
  const moodEnd = source.indexOf("function updateCinematicMood(", moodAt);
  const mood = source.slice(moodAt, moodEnd);

  assert.ok(stateAt >= 0 && stateAt < firstAwaitAt,
    "the nullable atmosphere state must exist before async model loading can yield to a frame");
  assert.ok(assignmentAt > firstAwaitAt,
    "the authored atmosphere remains initialized after the planet assets are available");
  assert.match(mood, /if \(atmosphereMaterial[?][.]uniforms\)/,
    "loading-scene frames must skip atmosphere uniforms until the material exists");
});

test("camera orbit state round-trips an authored pose without moving the geographic world", () => {
  const authored = {
    position: [2.4, 1.3, -3.7],
    target: [0.18, -0.22, 0.07],
    up: [0.1, 0.98, 0.12]
  };
  const state = createPlanetHubCameraOrbitState(authored);
  const pose = calculatePlanetHubCameraOrbitPose(state);
  const distance = (left, right) => Math.hypot(...left.map((value, index) => value - right[index]));
  assert.ok(distance(pose.position, authored.position) < 1e-9);
  assert.deepEqual(pose.target, authored.target);
  assert.ok(Math.abs(Math.hypot(...pose.up) - 1) < 1e-12);
  assert.ok(state.radius > 0);
});

test("Earth-to-Sun pivot handoff follows a scale-invariant arc that never approaches the Sun", () => {
  const earth = [0, 0, 0];
  const sun = [-0.14, 0, 0.99];
  const startRadius = 12742000 / 149597870700;
  const handoffRadius = Math.sqrt(384400000 * 299195741400) / 149597870700;
  const endRadius = 2;
  const directions = [
    [0.08, 0.12, 1],
    sun,
    sun.map((value) => -value),
    [-sun[2], 0.2, sun[0]],
    [0.002, 1, 0.002]
  ];
  for (const direction of directions) for (const scale of [1e4, 1e5, 4.5e5]) {
    const orientation = createPlanetHubCameraOrbitState({
      position: direction.map((value) => value * scale),
      target: earth,
      up: [0, 1, 0]
    });
    const directionLength = Math.hypot(...direction);
    const outward = direction.map((value) => value / directionLength);
    let previousDistance = 0;
    for (let index = 0; index <= 1000; index += 1) {
      const raw = index / 1000;
      const radius = Math.exp(Math.log(startRadius) * (1 - raw) + Math.log(endRadius) * raw);
      const orbit = calculatePlanetHubPivotHandoffOrbit(
        orientation,
        earth.map((value) => value * scale),
        sun.map((value) => value * scale),
        radius * scale,
        startRadius * scale,
        handoffRadius * scale,
        endRadius * scale
      );
      const pose = calculatePlanetHubCameraOrbitPose(orbit);
      assert.ok(Math.abs(pose.radius / scale - radius) < 1e-9,
        "the semantic arc preserves the prescribed physical dolly radius");
      const sunDistance = Math.hypot(...pose.position.map((value, axis) => (
        value - sun[axis] * scale
      ))) / scale;
      assert.ok(sunDistance >= previousDistance - 1e-10,
        `sample ${index} at common scale ${scale} cannot grow the physical Sun`);
      if (index === 0) assert.ok(Math.hypot(...pose.position.map((value, axis) => (
        value / scale - outward[axis] * startRadius
      ))) < 1e-9, "the Planet endpoint preserves the user's orbit direction");
      previousDistance = sunDistance;
    }
    assert.ok(Math.abs(previousDistance - endRadius) < 1e-10);
  }
});

test("planet hover silhouette samples remain camera-facing at every orbit pose", () => {
  const assertSilhouette = (cameraPosition) => {
    const samples = calculatePlanetHubCameraFacingSphereSamples({
      center: [0, 0, 0],
      radius: 1,
      cameraPosition,
      cameraUp: [0, 1, 0]
    });
    const forward = cameraPosition.map((value) => -value);
    const forwardLength = Math.hypot(...forward);
    const unitForward = forward.map((value) => value / forwardLength);
    for (const key of ["left", "right", "top", "bottom"]) {
      const offset = samples[key].map((value, index) => value - samples.center[index]);
      assert.ok(Math.abs(Math.hypot(...offset) - 1) < 1e-12);
      assert.ok(Math.abs(offset.reduce((sum, value, index) => sum + value * unitForward[index], 0)) < 1e-12,
        `${key} remains on the camera-facing silhouette plane`);
    }
    return samples;
  };
  const front = assertSilhouette([0, 0, 4.5]);
  const side = assertSilhouette([4.5, 0, 0]);
  assert.ok(Math.abs(front.right[0]) > 0.99);
  assert.ok(Math.abs(side.right[2]) > 0.99,
    "side views use camera right rather than collapsing fixed world-X samples");
});

test("visible globe motion uses a pole-safe transported camera frame while retaining radius and target", () => {
  const initial = createPlanetHubCameraOrbitState({
    position: [0, 0, 4.5],
    target: [0, 0, 0]
  });
  const right = applyPlanetHubVisualRotationToCameraOrbit(initial, { yaw: 0.4, pitch: 0.2 });
  assert.ok(right.azimuth < initial.azimuth,
    "a visible rightward globe turn requires the camera to orbit left");
  assert.ok(right.polar < initial.polar,
    "a visible downward globe turn requires the camera to orbit upward");
  assert.ok(Math.abs(right.radius - initial.radius) < 1e-12);
  assert.deepEqual(right.target, initial.target);
  const pose = calculatePlanetHubCameraOrbitPose(right);
  const outward = pose.position.map((value, index) => value - pose.target[index]);
  const normalizedOutward = outward.map((value) => value / Math.hypot(...outward));
  assert.ok(Math.abs(Math.hypot(...pose.up) - 1) < 1e-12);
  assert.ok(Math.abs(pose.up.reduce((sum, value, index) => sum + value * normalizedOutward[index], 0)) < 1e-12,
    "transported camera up remains orthogonal to its view radius");
});

test("view-band transitions preserve throw direction while capping astronomical angular speed", () => {
  const velocity = { yaw: 12, pitch: -5 };
  const system = rescalePlanetHubAngularVelocity({ velocity, fromBand: "planet", toBand: "system" });
  const universe = rescalePlanetHubAngularVelocity({ velocity: system, fromBand: "system", toBand: "universe" });
  assert.ok(Math.abs(Math.hypot(system.yaw, system.pitch) - PLANET_HUB_ANGULAR_SPEED_CAPS.system) < 1e-12);
  assert.ok(Math.hypot(universe.yaw, universe.pitch) <= PLANET_HUB_ANGULAR_SPEED_CAPS.universe);
  assert.ok(system.yaw > 0 && system.pitch < 0);
  assert.ok(Math.abs(system.yaw / system.pitch - velocity.yaw / velocity.pitch) < 1e-12,
    "band handoff cannot twist the user's throw direction");
});

test("semantic chart bands preserve controllable camera angular scales", () => {
  assert.equal(resolvePlanetHubAngularScale("system"), 0.38);
  assert.equal(resolvePlanetHubAngularScale("galaxy"), 0.2);
  assert.equal(resolvePlanetHubAngularScale("universe"), 0.12);
});

test("chart horizon comfort leaves the close planet free and permits roll-free travel below the grid", () => {
  const close = createPlanetHubCameraOrbitState({
    position: [0.2, -4.4, 0.3],
    target: [1, 2, 3],
    up: [1, 0, 0],
    velocity: { yaw: 0.4, pitch: -0.2 }
  });
  const unrestricted = constrainPlanetHubCameraOrbitForView(close, { progress: 0 });
  assert.ok(Math.abs(unrestricted.polar - close.polar) < 1e-12, "close-planet pole travel remains unrestricted");
  const chart = constrainPlanetHubCameraOrbitForView(close, {
    progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system
  });
  const pose = calculatePlanetHubCameraOrbitPose(chart);
  const outward = pose.position.map((value, index) => (value - pose.target[index]) / pose.radius);
  assert.ok(outward[1] < 0, "a deliberate underside orbit is preserved instead of being pushed above the plane");
  const sourcePose = calculatePlanetHubCameraOrbitPose(close);
  const sourceOutwardY = (sourcePose.position[1] - sourcePose.target[1]) / sourcePose.radius;
  assert.ok(Math.abs(outward[1] - sourceOutwardY) < 1e-9);
  assert.deepEqual(pose.target, [1, 2, 3]);
  assert.ok(Math.abs(chart.radius - close.radius) < 1e-12);
  assert.ok(Math.abs(pose.up.reduce((sum, value, index) => sum + value * outward[index], 0)) < 1e-9);
});

const normalizedTestVector = (value, fallback = [0, 1, 0]) => {
  const length = Math.hypot(...value);
  return length > 1e-12 ? value.map((coordinate) => coordinate / length) : [...fallback];
};

const canonicalEclipticUp = (pose, worldUp = [0, 1, 0]) => {
  const outward = normalizedTestVector(pose.position.map((coordinate, index) => (
    coordinate - pose.target[index]
  )), [0, 0, 1]);
  const alongView = worldUp.reduce((sum, coordinate, index) => sum + coordinate * outward[index], 0);
  return normalizedTestVector(worldUp.map((coordinate, index) => (
    coordinate - outward[index] * alongView
  )));
};

const dotTestVectors = (left, right) => left.reduce((sum, coordinate, index) => (
  sum + coordinate * right[index]
), 0);

test("every visible chart band derives camera up from the fixed ecliptic normal", () => {
  const rolled = createPlanetHubCameraOrbitState({
    position: [2.6, 2.2, 3.1],
    target: [0.4, -0.2, 0.7],
    up: [0.92, 0.2, -0.33]
  });
  for (const [band, progress] of [
    ["orbit-entry", PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit * 0.5],
    ["orbit", PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit],
    ["system", PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system],
    ["universe", PLANET_HUB_ZOOM_ANCHOR_PROGRESS.universe]
  ]) {
    const constrained = constrainPlanetHubCameraOrbitForView(rolled, { progress });
    const pose = calculatePlanetHubCameraOrbitPose(constrained);
    const canonicalUp = canonicalEclipticUp(pose);
    assert.ok(dotTestVectors(pose.up, canonicalUp) > 1 - 1e-9,
      `${band} removes accumulated roll instead of rotating the chart with the camera`);

    const forward = normalizedTestVector(pose.target.map((coordinate, index) => (
      coordinate - pose.position[index]
    )), [0, 0, -1]);
    const eclipticHorizon = normalizedTestVector([
      forward[2],
      0,
      -forward[0]
    ], [1, 0, 0]);
    assert.ok(Math.abs(dotTestVectors(eclipticHorizon, pose.up)) < 1e-9,
      `${band} keeps both sides of the physical ecliptic at one screen height`);
  }
});

test("repeated diagonal chart orbit cannot accumulate camera roll", () => {
  for (const [band, progress] of [
    ["orbit-entry", PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit * 0.5],
    ["orbit", PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit],
    ["system", PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system],
    ["universe", PLANET_HUB_ZOOM_ANCHOR_PROGRESS.universe]
  ]) {
    let orbit = createPlanetHubCameraOrbitState({
      position: [0.8, 2.4, 4.1],
      target: [0, 0, 0],
      up: [0, 1, 0]
    });
    for (let index = 0; index < 96; index += 1) {
      orbit = constrainPlanetHubCameraOrbitForView(
        applyPlanetHubVisualRotationToCameraOrbit(orbit, {
          yaw: 0.027,
          pitch: index % 2 === 0 ? 0.014 : -0.009
        }),
        { progress }
      );
      const pose = calculatePlanetHubCameraOrbitPose(orbit);
      assert.ok(dotTestVectors(pose.up, canonicalEclipticUp(pose)) > 1 - 1e-8,
        `${band} frame ${index} stays roll-free during compound yaw/pitch navigation`);
    }
  }
});

test("chart polar clamps act only at the spherical singularities", () => {
  const stateAtPolar = (polar, velocity) => createPlanetHubCameraOrbitState({
    position: [0, Math.cos(polar) * 12, Math.sin(polar) * 12],
    target: [0, 0, 0],
    up: [0, 1, 0],
    velocity
  });
  const upperBlocked = constrainPlanetHubCameraOrbitForView(
    stateAtPolar(0.0001, { yaw: 0.7, pitch: 0.6 }),
    { progress: 1 }
  );
  assert.equal(upperBlocked.velocity.yaw, 0.7, "polar clamping never consumes yaw inertia");
  assert.equal(upperBlocked.velocity.pitch, 0,
    "positive pitch cannot keep pushing through the north-pole singularity");

  const upperInward = constrainPlanetHubCameraOrbitForView(
    stateAtPolar(0.0001, { yaw: 0.7, pitch: -0.6 }),
    { progress: 1 }
  );
  assert.equal(upperInward.velocity.pitch, -0.6,
    "negative pitch remains available to travel away from the north pole");

  const lowerBlocked = constrainPlanetHubCameraOrbitForView(
    stateAtPolar(Math.PI - 0.0001, { yaw: -0.45, pitch: -0.35 }),
    { progress: 1 }
  );
  assert.equal(lowerBlocked.velocity.yaw, -0.45);
  assert.equal(lowerBlocked.velocity.pitch, 0,
    "negative pitch cannot keep pushing through the south-pole singularity");

  const lowerInward = constrainPlanetHubCameraOrbitForView(
    stateAtPolar(Math.PI - 0.0001, { yaw: -0.45, pitch: 0.35 }),
    { progress: 1 }
  );
  assert.equal(lowerInward.velocity.pitch, 0.35,
    "positive pitch remains available to travel away from the south pole");
});

test("chart yaw and pitch orbit around a stationary ecliptic plane", () => {
  let orbit = createPlanetHubCameraOrbitState({
    position: [0.4, 2.5, 4.2],
    target: [7, 0, -3],
    up: [0, 1, 0]
  });
  const start = calculatePlanetHubCameraOrbitPose(orbit);
  for (const delta of [
    { yaw: 0.28, pitch: 0 },
    { yaw: 0, pitch: 0.17 },
    { yaw: -0.13, pitch: -0.08 }
  ]) {
    orbit = constrainPlanetHubCameraOrbitForView(
      applyPlanetHubVisualRotationToCameraOrbit(orbit, delta),
      { progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system }
    );
    const pose = calculatePlanetHubCameraOrbitPose(orbit);
    assert.deepEqual(pose.target, start.target, "navigation moves the camera, never the ecliptic origin");
    assert.ok(Math.abs(pose.radius - start.radius) < 1e-9);
    assert.ok(dotTestVectors(pose.up, canonicalEclipticUp(pose)) > 1 - 1e-9,
      "the ecliptic normal remains the camera's stable vertical reference");
  }
  const end = calculatePlanetHubCameraOrbitPose(orbit);
  assert.ok(Math.hypot(...end.position.map((coordinate, index) => coordinate - start.position[index])) > 0.2,
    "the camera still travels around the chart rather than freezing the scene");
});

test("close Planet navigation remains a free arcball instead of inheriting chart horizon lock", () => {
  const rolled = createPlanetHubCameraOrbitState({
    position: [1.2, 1.7, 4],
    target: [0, 0, 0],
    up: [0.9, 0.15, -0.4]
  });
  const free = constrainPlanetHubCameraOrbitForView(rolled, { progress: 0 });
  const pose = calculatePlanetHubCameraOrbitPose(free);
  assert.ok(dotTestVectors(pose.up, canonicalEclipticUp(pose)) < 0.98,
    "a deliberately rolled close view must not be silently levelled");
  assert.ok(Math.hypot(...pose.up.map((coordinate, index) => coordinate - rolled.up[index])) < 1e-12,
    "Planet mode retains its transported arcball frame exactly");
});

test("entering the Orbit chart lock is positionally and rotationally continuous", () => {
  const rolled = createPlanetHubCameraOrbitState({
    position: [2.1, -1.3, 3.7],
    target: [0.3, 0.1, -0.2],
    up: [0.82, 0.18, -0.54]
  });
  const levelingStart = PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit * 0.2;
  const epsilon = Math.min(0.0001, levelingStart * 0.01);
  const before = calculatePlanetHubCameraOrbitPose(
    constrainPlanetHubCameraOrbitForView(rolled, { progress: levelingStart - epsilon })
  );
  const after = calculatePlanetHubCameraOrbitPose(
    constrainPlanetHubCameraOrbitForView(rolled, { progress: levelingStart + epsilon })
  );
  assert.ok(Math.hypot(...after.position.map((coordinate, index) => coordinate - before.position[index])) < 0.01,
    "the globe cannot jump when the chart first becomes authoritative");
  assert.ok(Math.hypot(...after.up.map((coordinate, index) => coordinate - before.up[index])) < 0.01,
    "horizon acquisition must blend rather than snap at the chart boundary");
});

test("wide chart transitions stay level through every interpolated seam-crossing frame", () => {
  const canonicalState = ({ position, target }) => {
    const authored = createPlanetHubCameraOrbitState({ position, target, up: [0, 1, 0] });
    const pose = calculatePlanetHubCameraOrbitPose(authored);
    return createPlanetHubCameraOrbitState({
      position: pose.position,
      target: pose.target,
      up: canonicalEclipticUp(pose)
    });
  };
  // These endpoints sit on opposite sides of the +/- PI azimuth seam, use
  // substantially different elevations, move the semantic centre, and span
  // a wide Orbit-to-System camera-radius change.
  const from = canonicalState({
    position: [0.55, 9.02, -7.9],
    target: [0, 0, 0]
  });
  const to = canonicalState({
    position: [2.35, 18.8, -66.1],
    target: [9, 0, -4]
  });

  for (const [band, chartProgress] of [
    ["orbit", PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit],
    ["system", PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system]
  ]) {
    let previous = null;
    for (let frame = 0; frame <= 48; frame += 1) {
      const transitionProgress = frame / 48;
      const interpolated = interpolatePlanetHubCameraOrbitState({
        from,
        to,
        progress: transitionProgress
      });
      const constrained = constrainPlanetHubCameraOrbitForView(interpolated, {
        progress: chartProgress
      });
      const pose = calculatePlanetHubCameraOrbitPose(constrained);
      assert.ok(dotTestVectors(pose.up, canonicalEclipticUp(pose)) > 1 - 1e-8,
        `${band} transition frame ${frame} cannot expose parallel-transport roll`);
      if (previous) {
        const step = Math.hypot(...pose.position.map((coordinate, index) => (
          coordinate - previous.position[index]
        )));
        assert.ok(Number.isFinite(step) && step < 3,
          `${band} transition frame ${frame} remains continuous across the azimuth seam`);
      }
      previous = pose;
    }
  }
});

test("overview and body-focus-return transitions level chart frames before camera application", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const renderAt = source.indexOf("function renderFrame(");
  const bodyFocusAt = source.indexOf("if (bodyFocusTransition) {", renderAt);
  const presentationAt = source.indexOf("if (transition) {", bodyFocusAt);
  const zoomAt = source.indexOf("if (zoomPending", presentationAt);
  const journeyAt = source.indexOf("if (journeyDeparture) {", zoomAt);
  const overviewMotionAt = source.indexOf("if (hubMode === \"overview\"", journeyAt);
  assert.ok(renderAt >= 0 && bodyFocusAt > renderAt && presentationAt > bodyFocusAt
    && zoomAt > presentationAt && journeyAt > zoomAt && overviewMotionAt > journeyAt);

  const assertConstrainedInterpolation = (branch, label) => {
    const interpolateAt = branch.indexOf("interpolatePlanetHubCameraOrbitState(");
    const constrainAt = branch.indexOf("constrainPlanetHubCameraOrbitForView(");
    const applyAt = branch.indexOf("applyCameraOrbitState(");
    const nestedConstraint = applyAt >= 0 && constrainAt > applyAt && interpolateAt > constrainAt;
    const stagedConstraint = interpolateAt >= 0 && constrainAt > interpolateAt && applyAt > constrainAt;
    assert.ok(nestedConstraint || stagedConstraint,
      `${label} must constrain the interpolated chart orbit before applying it to the camera`);
    assert.match(branch, /progress:\s*viewZoom[.]progress/u,
      `${label} must level against the live semantic chart band`);
  };

  assertConstrainedInterpolation(source.slice(bodyFocusAt, presentationAt), "body-focus return");
  assertConstrainedInterpolation(source.slice(presentationAt, zoomAt), "overview presentation");

  const journeyBranch = source.slice(journeyAt, overviewMotionAt);
  assert.match(journeyBranch, /calculatePlanetHubJourneyCameraPose\(/u,
    "Journey retains its authored launch/chase/landing camera system");
  assert.doesNotMatch(journeyBranch, /constrainPlanetHubCameraOrbitForView\(/u,
    "ecliptic chart levelling must never overwrite Journey cinematography");
  assert.doesNotMatch(journeyBranch, /interpolatePlanetHubCameraOrbitState\(/u,
    "Journey remains separate from overview orbit interpolation");
});

test("arcball camera crosses both poles continuously without trapping pitch velocity", () => {
  let orbit = createPlanetHubCameraOrbitState({
    position: [0, 0.12, 4.5],
    target: [0, 0, 0],
    velocity: { yaw: 0.15, pitch: 1.1 }
  });
  let previousPose = calculatePlanetHubCameraOrbitPose(orbit);
  for (let index = 0; index < 220; index += 1) {
    orbit = applyPlanetHubVisualRotationToCameraOrbit(orbit, {
      yaw: 0.004,
      pitch: 0.025,
      velocity: orbit.velocity
    });
    const pose = calculatePlanetHubCameraOrbitPose(orbit);
    const stepDistance = Math.hypot(...pose.position.map((value, axis) => value - previousPose.position[axis]));
    const outward = pose.position.map((value, axis) => value - pose.target[axis]);
    const radius = Math.hypot(...outward);
    const unitOutward = outward.map((value) => value / radius);
    assert.ok(Number.isFinite(stepDistance) && stepDistance > 0);
    assert.ok(stepDistance < 0.14, `frame ${index} remains continuous (${stepDistance})`);
    assert.ok(Math.abs(radius - orbit.radius) < 1e-9);
    assert.ok(Math.abs(Math.hypot(...pose.up) - 1) < 1e-9);
    assert.ok(Math.abs(pose.up.reduce((sum, value, axis) => sum + value * unitOutward[axis], 0)) < 1e-9);
    assert.equal(orbit.velocity.pitch, 1.1, "pitch velocity survives pole traversal instead of lodging in a clamp");
    previousPose = pose;
  }
});

test("camera orbit interpolation takes the short azimuth route and lands exactly", () => {
  const from = {
    ...createPlanetHubCameraOrbitState({ position: [0, 0, -4], target: [0, 0, 0] }),
    azimuth: Math.PI - 0.08
  };
  const to = {
    ...createPlanetHubCameraOrbitState({ position: [0, 0, -2], target: [0.2, 0.4, 0] }),
    azimuth: -Math.PI + 0.08
  };
  const middle = interpolatePlanetHubCameraOrbitState({ from, to, progress: 0.5 });
  assert.ok(Math.abs(Math.abs(middle.azimuth) - Math.PI) < 0.02,
    "the midpoint crosses the nearby PI seam instead of orbiting the long way around");
  const landed = interpolatePlanetHubCameraOrbitState({ from, to, progress: 1 });
  const landedPose = calculatePlanetHubCameraOrbitPose(landed);
  const targetPose = calculatePlanetHubCameraOrbitPose(to);
  assert.ok(Math.hypot(...landedPose.position.map((value, index) => value - targetPose.position[index])) < 1e-9);
  assert.deepEqual(landedPose.target, targetPose.target);
});

test("direct drag follows the hand and releases into bounded inertia", () => {
  const right = calculatePlanetHubDragRotation({
    deltaX: 80,
    deltaY: 0,
    deltaMs: 16,
    width: 1280,
    height: 720
  });
  assert.ok(right.delta.yaw > 0, "dragging right spins the visible world right");
  assert.equal(right.delta.pitch, 0);
  assert.ok(right.velocity.yaw > 0);

  const down = calculatePlanetHubDragRotation({
    deltaX: 0,
    deltaY: 60,
    deltaMs: 20,
    width: 390,
    height: 844
  });
  assert.ok(down.delta.pitch > 0, "dragging down spins the visible world downward");
  assert.equal(down.delta.yaw, 0);

  const reverse = calculatePlanetHubDragRotation({
    deltaX: -80,
    deltaY: -60,
    deltaMs: 16,
    width: 1280,
    height: 720,
    velocity: right.velocity
  });
  assert.ok(reverse.delta.yaw < 0);
  assert.ok(reverse.delta.pitch < 0);
  assert.ok(Math.abs(reverse.velocity.yaw) <= 2.4);
  assert.ok(Math.abs(reverse.velocity.pitch) <= 2.4);

  const coast = stepPlanetHubRotation({
    velocity: right.velocity,
    input: null,
    idleYaw: 0,
    releaseResponse: 3.4,
    deltaSeconds: 1 / 60
  });
  assert.ok(coast.delta.yaw > 0, "release preserves the drag direction for a short coast");
  assert.ok(Math.abs(coast.velocity.yaw) < Math.abs(right.velocity.yaw));
});

test("passive hover never creates motion while drag follows the hand", () => {
  const drag = calculatePlanetHubDragRotation({
    deltaX: 40,
    deltaY: 24,
    width: 1280,
    height: 720
  });
  const passive = stepPlanetHubRotation({
    velocity: { yaw: 0, pitch: 0 },
    input: { x: 1, y: 0.6, intensity: 1 },
    idleYaw: 0,
    deltaSeconds: 0.05
  });
  assert.deepEqual(passive.delta, { yaw: 0, pitch: 0 });

  const initial = createPlanetHubCameraOrbitState({ position: [0, 0, 4.5] });
  const draggedCamera = applyPlanetHubVisualRotationToCameraOrbit(initial, drag.delta);
  assert.notEqual(draggedCamera.azimuth, initial.azimuth);
  assert.notEqual(draggedCamera.polar, initial.polar);
});

test("drag release combines speed and distance through a bounded exponential flick", () => {
  const release = (distancePx, recentSpeedPxPerMs, extra = {}) => calculatePlanetHubDragRelease({
    displacementX: distancePx,
    displacementY: 0,
    distancePx,
    recentVelocityX: recentSpeedPxPerMs,
    recentVelocityY: 0,
    recentSpeedPxPerMs,
    width: 1280,
    height: 720,
    ...extra
  });
  const shortSlow = release(24, 0.18);
  const longSlow = release(400, 0.18);
  const shortFast = release(24, 1.8);
  const longFast = release(400, 1.8);

  assert.ok(longSlow.force > shortSlow.force, "distance adds release force at the same speed");
  assert.ok(shortFast.force > shortSlow.force, "speed adds release force at the same distance");
  assert.ok(longFast.force > shortFast.force);
  assert.ok(shortFast.force > longSlow.force);
  assert.ok(longFast.angularSpeed > shortFast.angularSpeed);
  assert.ok(longFast.response < shortFast.response, "a stronger flick coasts longer");

  const diagonal = calculatePlanetHubDragRelease({
    displacementX: 400,
    displacementY: 400,
    recentVelocityX: 1.8,
    recentVelocityY: 1.8,
    width: 1280,
    height: 720
  });
  assert.ok(diagonal.velocity.yaw > 0 && diagonal.velocity.pitch > 0);
  assert.ok(Math.abs(diagonal.velocity.yaw - diagonal.velocity.pitch) < 1e-9);
  assert.ok(Math.hypot(diagonal.velocity.yaw, diagonal.velocity.pitch) <= PLANET_HUB_THROW_MAX_ANGULAR_SPEED + 1e-9,
    "the vector magnitude, not each axis, is capped");

  const reversal = calculatePlanetHubDragRelease({
    displacementX: 400,
    recentVelocityX: -1.8,
    width: 1280,
    height: 720
  });
  assert.ok(reversal.velocity.yaw < 0, "the final flick direction wins over the earlier sweep");

  const terminalJitter = calculatePlanetHubDragRelease({
    displacementX: 400,
    recentVelocityX: -0.04,
    recentSpeedPxPerMs: 0.04,
    width: 1280,
    height: 720
  });
  assert.ok(terminalJitter.velocity.yaw > 0,
    "a tiny opposite release wobble cannot reverse the stable gesture direction");
  assert.deepEqual(calculatePlanetHubReleaseDirection({
    displacementX: 400,
    recentVelocityX: -1.8
  }), [-1, 0], "a deliberate fast reversal still wins");

  const paused = release(400, 1.8, { heldStillMs: 400 });
  assert.ok(paused.angularSpeed < longFast.angularSpeed, "holding still before release brakes the same flick");
  assert.equal(release(7, 4).angularSpeed, 0);
  const saturated = release(10000, 100);
  assert.ok(Number.isFinite(saturated.angularSpeed));
  assert.ok(saturated.angularSpeed <= PLANET_HUB_THROW_MAX_ANGULAR_SPEED);
  assert.ok(saturated.force <= 1);
});

test("a fast far throw is five times stronger and carries through several full turns", () => {
  const release = (distancePx, recentSpeedPxPerMs) => calculatePlanetHubDragRelease({
    displacementX: distancePx,
    displacementY: 0,
    distancePx,
    recentVelocityX: recentSpeedPxPerMs,
    recentVelocityY: 0,
    recentSpeedPxPerMs,
    width: 1280,
    height: 720
  });
  const ordinary = release(160, 0.32);
  const fastFar = release(520, 2.4);

  assert.ok(ordinary.angularSpeed < 1,
    `ordinary drags must remain controlled, received ${ordinary.angularSpeed}`);
  assert.ok(fastFar.angularSpeed >= PLANET_HUB_THROW_MAX_ANGULAR_SPEED * 0.96,
    `a committed throw should approach the 5x cap, received ${fastFar.angularSpeed}`);
  assert.ok(fastFar.angularSpeed <= PLANET_HUB_THROW_MAX_ANGULAR_SPEED + 1e-9,
    "release speed remains bounded at exactly five times the original cap");
  assert.equal(fastFar.throwMultiplier, PLANET_HUB_THROW_MAX_MULTIPLIER);
  assert.ok(fastFar.response <= 0.8,
    `high-energy throws should retain enough momentum for multiple turns, received ${fastFar.response}`);

  let rotation = { velocity: fastFar.velocity, delta: { yaw: 0, pitch: 0 } };
  let travelled = 0;
  for (let frame = 0; frame < 300; frame += 1) {
    rotation = stepPlanetHubRotation({
      velocity: rotation.velocity,
      input: null,
      idleYaw: 0,
      releaseResponse: fastFar.response,
      deltaSeconds: 1 / 60
    });
    travelled += Math.hypot(rotation.delta.yaw, rotation.delta.pitch);
  }
  assert.ok(travelled > Math.PI * 2 * 5,
    `a saturated throw should coast through more than five complete turns, received ${travelled / (Math.PI * 2)} turns`);
});

test("ordinary drag releases visibly and owns the globe through post-release mouse jitter", () => {
  const ordinary = calculatePlanetHubDragRelease({
    displacementX: 160,
    distancePx: 160,
    recentVelocityX: 0.32,
    recentSpeedPxPerMs: 0.32,
    heldStillMs: 120,
    width: 1280,
    height: 720
  });
  assert.ok(ordinary.angularSpeed >= 0.55,
    `ordinary human drag should visibly coast, received ${ordinary.angularSpeed}`);
  assert.ok(ordinary.response <= 2.55, "ordinary coast should decay over more than a blink");

  const duration = calculatePlanetHubCoastDuration(ordinary);
  assert.ok(duration >= PLANET_HUB_COAST_MIN_MS);
  assert.ok(duration <= PLANET_HUB_COAST_MAX_MS);
  assert.equal(shouldPlanetHubCoastOwnInput({
    nowMs: 100,
    coastUntil: 100 + duration,
    velocity: ordinary.velocity
  }), true, "dead-zone or landmark jitter must not steal a fresh release");
  assert.equal(shouldPlanetHubCoastOwnInput({
    nowMs: 101 + duration,
    coastUntil: 100 + duration,
    velocity: ordinary.velocity
  }), false);

  let rotation = { velocity: ordinary.velocity, delta: { yaw: 0, pitch: 0 } };
  let travelled = 0;
  for (let frame = 0; frame < 42; frame += 1) {
    rotation = stepPlanetHubRotation({
      velocity: rotation.velocity,
      input: null,
      idleYaw: 0,
      releaseResponse: ordinary.response,
      deltaSeconds: 1 / 60
    });
    travelled += Math.hypot(rotation.delta.yaw, rotation.delta.pitch);
  }
  assert.ok(travelled > 0.16,
    `ordinary release should travel at least nine degrees, received ${travelled}`);
});

test("globe rotation idles, coasts, settles, and honors hard stops", () => {
  const idle = stepPlanetHubRotation({ velocity: { yaw: 0, pitch: 0 }, deltaSeconds: 0.05 });
  assert.ok(idle.velocity.yaw > 0 && idle.velocity.yaw < PLANET_HUB_IDLE_YAW_SPEED);
  assert.equal(idle.velocity.pitch, 0);

  const coast = stepPlanetHubRotation({
    velocity: { yaw: -0.5, pitch: 0.3 },
    input: null,
    idleYaw: 0,
    releaseResponse: 16,
    deltaSeconds: 0.05
  });
  assert.ok(coast.velocity.yaw < 0 && Math.abs(coast.velocity.yaw) < 0.5);
  assert.ok(coast.velocity.pitch > 0 && coast.velocity.pitch < 0.3);

  let settled = coast;
  for (let index = 0; index < 120; index += 1) {
    settled = stepPlanetHubRotation({
      velocity: settled.velocity,
      input: null,
      idleYaw: PLANET_HUB_IDLE_YAW_SPEED,
      releaseResponse: 8.5,
      deltaSeconds: 0.05
    });
  }
  assert.ok(Math.abs(settled.velocity.yaw - PLANET_HUB_IDLE_YAW_SPEED) < 1e-5);
  assert.ok(Math.abs(settled.velocity.pitch) < 1e-5);

  assert.deepEqual(stepPlanetHubRotation({
    velocity: { yaw: 0.6, pitch: -0.4 },
    input: { x: 1, y: 1, intensity: 1 },
    enabled: false
  }), {
    velocity: { yaw: 0, pitch: 0 },
    delta: { yaw: 0, pitch: 0 },
    moving: false
  });
});

test("semantic chart zoom never rotates the user's camera through passive idle yaw", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  assert.match(source, /reducedMotion:\s*reducedMotion\s*\|\|\s*viewZoom\.band\s*!==\s*["']planet["']/,
    "only the close planet presentation may use ambient camera yaw");
});

test("coast remains unbiased and idle resumes only after a settled pause", () => {
  const coasting = stepPlanetHubIdleState({
    state: { active: true, settledSince: 0 },
    nowMs: 100,
    velocity: { yaw: -0.6, pitch: 0.1 },
    coasting: true
  });
  assert.equal(coasting.idleYaw, 0);
  assert.equal(coasting.state.active, false);

  let velocity = { yaw: -0.6, pitch: 0.1 };
  for (let frame = 0; frame < 180; frame += 1) {
    const step = stepPlanetHubRotation({
      velocity,
      input: null,
      idleYaw: coasting.idleYaw,
      releaseResponse: 2.4,
      deltaSeconds: 1 / 60
    });
    assert.ok(step.velocity.yaw <= 0, `coast frame ${frame} cannot reverse into idle`);
    velocity = step.velocity;
  }

  const settledAt = stepPlanetHubIdleState({
    state: coasting.state,
    nowMs: 4000,
    velocity: { yaw: -0.006, pitch: 0 }
  });
  assert.equal(settledAt.waiting, true);
  assert.equal(settledAt.idleYaw, 0);
  const stillWaiting = stepPlanetHubIdleState({
    state: settledAt.state,
    nowMs: 4000 + PLANET_HUB_IDLE_RESUME_DELAY_MS - 1,
    velocity: { yaw: -0.001, pitch: 0 }
  });
  assert.equal(stillWaiting.waiting, true);
  assert.equal(stillWaiting.resetVelocity, false);
  const resumed = stepPlanetHubIdleState({
    state: stillWaiting.state,
    nowMs: 4000 + PLANET_HUB_IDLE_RESUME_DELAY_MS,
    velocity: { yaw: -0.0005, pitch: 0 }
  });
  assert.equal(resumed.idleYaw, PLANET_HUB_IDLE_YAW_SPEED);
  assert.equal(resumed.resetVelocity, true,
    "the imperceptible opposite remnant is cleared before canonical idle starts");
  const firstIdle = stepPlanetHubRotation({
    velocity: resumed.resetVelocity ? { yaw: 0, pitch: 0 } : { yaw: -0.0005, pitch: 0 },
    idleYaw: resumed.idleYaw,
    deltaSeconds: 1 / 60
  });
  assert.ok(firstIdle.velocity.yaw > 0);
});

test("center activation uses hysteresis, dwell, and cooldown without flicker", () => {
  let result = stepPlanetHubFrontActivation({
    state: { active: "forge", candidate: null, candidateSince: null, lastChangedAt: null },
    scores: { forge: 0.3, journey: 0.97, arena: -0.4 },
    nowMs: 100
  });
  assert.equal(result.changed, false);
  assert.equal(result.state.candidate, "journey");

  result = stepPlanetHubFrontActivation({
    state: result.state,
    scores: { forge: 0.25, journey: 0.975, arena: -0.3 },
    nowMs: 279
  });
  assert.equal(result.changed, false, "candidate has not completed the 180ms dwell");

  result = stepPlanetHubFrontActivation({
    state: result.state,
    scores: { forge: 0.2, journey: 0.98, arena: -0.2 },
    nowMs: 280
  });
  assert.equal(result.changed, true);
  assert.equal(result.destination, "journey");
  assert.equal(result.previousDestination, "forge");

  const cooling = stepPlanetHubFrontActivation({
    state: result.state,
    scores: { forge: -0.2, journey: 0.2, arena: 0.99 },
    nowMs: 500
  });
  assert.equal(cooling.changed, false);
  assert.equal(cooling.state.candidate, null, "320ms cooldown suppresses a new candidate");

  const hysteresis = stepPlanetHubFrontActivation({
    state: { active: "journey", candidate: null, candidateSince: null, lastChangedAt: null },
    scores: { forge: -0.2, journey: 0.91, arena: 0.96 },
    nowMs: 1000
  });
  assert.equal(hysteresis.destination, "journey");
  assert.equal(hysteresis.state.candidate, null, "active destination stays latched above the exit threshold");
});

test("Earth satellite follows a calm readable inclined orbit and reduced motion freezes its pose", () => {
  const start = calculatePlanetHubSatellitePose({ elapsedMs: 0 });
  const later = calculatePlanetHubSatellitePose({ elapsedMs: PLANET_HUB_MOON_ORBIT_PERIOD_MS / 4 });
  const startRadius = Math.hypot(...start.position);
  const laterRadius = Math.hypot(...later.position);
  assert.ok(Math.abs(startRadius - PLANET_HUB_MOON_ORBIT_RADIUS) < 1e-9);
  assert.ok(Math.abs(laterRadius - PLANET_HUB_MOON_ORBIT_RADIUS) < 1e-9);
  assert.equal(PLANET_HUB_MOON_RADIUS_RATIO, 0.273);
  assert.notDeepEqual(later.position, start.position);

  const reducedA = calculatePlanetHubSatellitePose({ elapsedMs: 0, reducedMotion: true });
  const reducedB = calculatePlanetHubSatellitePose({ elapsedMs: 500000, reducedMotion: true });
  assert.deepEqual(reducedB, reducedA);
});

test("reduced-motion Moon composition stays upper-right, behind Earth, and on its authored orbit", () => {
  const position = calculatePlanetHubReducedMotionSatellitePosition({
    outwardToCamera: [0, 0, 1],
    screenRight: [1, 0, 0],
    screenUp: [0, 1, 0]
  });
  assert.ok(Math.abs(Math.hypot(...position) - PLANET_HUB_MOON_ORBIT_RADIUS) < 1e-9);
  assert.ok(position[0] > 0, "Moon composes to camera-right");
  assert.ok(position[1] > 0, "Moon composes above Earth");
  assert.ok(position[2] < 0, "Moon remains farther from the camera than Earth");
  assert.deepEqual(
    calculatePlanetHubReducedMotionSatellitePosition({
      outwardToCamera: [0, 0, 1],
      screenRight: [1, 0, 0],
      screenUp: [0, 1, 0]
    }),
    position,
    "motion-safe composition is deterministic"
  );
});

test("Moon perspective compensation preserves its apparent Earth ratio across near and far arcs", () => {
  const nearScale = calculatePlanetHubSatellitePerspectiveScale({
    earthCameraDistance: 4.5,
    satelliteCameraDistance: 2.25
  });
  const farScale = calculatePlanetHubSatellitePerspectiveScale({
    earthCameraDistance: 4.5,
    satelliteCameraDistance: 9
  });
  assert.ok(Math.abs((nearScale / 2.25) - (PLANET_HUB_MOON_RADIUS_RATIO / 4.5)) < 1e-12);
  assert.ok(Math.abs((farScale / 9) - (PLANET_HUB_MOON_RADIUS_RATIO / 4.5)) < 1e-12);
  assert.ok(farScale > nearScale, "far-arc world scale grows only enough to offset perspective shrinkage");
});

test("the Moon phase adapts to portrait while the physical Sun stays fixed in world space", () => {
  const wide = calculatePlanetHubCelestialLayout({ aspect: 16 / 9 });
  const phone = calculatePlanetHubCelestialLayout({ aspect: 390 / 714 });
  assert.ok(Math.abs(wide.sunPosition[0] - PLANET_HUB_SUN_PLACEMENT.position[0]) < 0.01);
  assert.deepEqual(wide.sunPosition.slice(1), [...PLANET_HUB_SUN_PLACEMENT.position].slice(1));
  assert.equal(wide.sunScale, PLANET_HUB_SUN_PLACEMENT.scale);
  assert.deepEqual(phone.sunPosition, wide.sunPosition, "viewport shape cannot move a physical Sun");
  assert.equal(phone.sunScale, wide.sunScale);
  assert.ok(phone.satellitePhaseOffset > wide.satellitePhaseOffset,
    "portrait Moon begins on a visible upper arc instead of beyond the right edge");
});

test("Moon pick proxy resolves through its hierarchy while the decorative Sun remains untargeted", () => {
  const moonRoot = { userData: { planetHubSatellite: "moon" }, parent: null };
  const moonProxy = { userData: {}, parent: moonRoot };
  const sunRoot = { userData: {}, parent: null };
  const sunMesh = { userData: {}, parent: sunRoot };
  assert.equal(resolvePlanetHubRaycastTarget(moonProxy), "moon");
  assert.equal(resolvePlanetHubRaycastTarget(sunMesh), null);
});

test("raycast detail distinguishes the Journey rocket action from its landing platform", () => {
  const site = { userData: { planetHubDestination: "journey" }, parent: null };
  const platform = { userData: {}, parent: site };
  const rocket = { userData: { planetHubAction: "journey-launch" }, parent: site };
  const rocketMesh = { userData: {}, parent: rocket };
  assert.deepEqual(resolvePlanetHubRaycastDetail(rocketMesh), {
    target: "journey",
    destination: "journey",
    action: "journey-launch",
    satellite: null,
    body: null
  });
  assert.deepEqual(resolvePlanetHubRaycastDetail(platform), {
    target: "journey",
    destination: "journey",
    action: null,
    satellite: null,
    body: null
  });
});

test("bounds-aware Journey docking rests the rocket on the platform without losing authored horizontal placement", () => {
  const dock = calculatePlanetHubRocketDock({
    platformBounds: { min: [-0.4, -0.05, -0.4], max: [0.4, 0.051, 0.4] },
    rocketBounds: { min: [-0.1, -0.2, -0.1], max: [0.1, 0.5, 0.1] },
    fallback: [0.03, 0.16, -0.02],
    clearance: 0.004
  });
  assert.deepEqual(dock, [0.03, 0.255, -0.02]);
  assert.ok(Math.abs((dock[1] - 0.2) - 0.055) < 1e-12,
    "the translated rocket bottom should clear the platform top by exactly 0.004 local units");
  assert.deepEqual(calculatePlanetHubRocketDock({ fallback: [0.03, 0.16, -0.02] }), [0.03, 0.16, -0.02]);
});

test("atlas Sun placement stays distant while surface rotation honors motion settings", () => {
  assert.ok(PLANET_HUB_SUN_PLACEMENT.position.every(Number.isFinite));
  assert.ok(Math.hypot(...PLANET_HUB_SUN_PLACEMENT.position) >= 9,
    "the atlas source remains distant enough to produce meaningful parallax");
  assert.ok(PLANET_HUB_SUN_PLACEMENT.scale > 0 && PLANET_HUB_SUN_PLACEMENT.scale < 1,
    "the chart radius remains positive and smaller than the focused world");
  const start = calculatePlanetHubSunRotation({ elapsedMs: 0 });
  const later = calculatePlanetHubSunRotation({ elapsedMs: 10000 });
  assert.ok(later > start);
  assert.equal(
    calculatePlanetHubSunRotation({ elapsedMs: 10000, reducedMotion: true }),
    calculatePlanetHubSunRotation({ elapsedMs: 0, reducedMotion: true })
  );
});

test("landmark hover and committed focus light the facade independently", () => {
  const idle = calculatePlanetHubHoverFocus({ level: 0, elapsedMs: 0 });
  const active = calculatePlanetHubHoverFocus({ level: 1, elapsedMs: 240 });
  const selected = calculatePlanetHubHoverFocus({ level: 0, selected: true, elapsedMs: 240 });
  const selectedActive = calculatePlanetHubHoverFocus({ level: 1, selected: true, elapsedMs: 240 });
  const focused = calculatePlanetHubHoverFocus({ level: 0, focused: true, elapsedMs: 240 });
  const focusedActive = calculatePlanetHubHoverFocus({ level: 1, focused: true, elapsedMs: 240 });
  const still = calculatePlanetHubHoverFocus({ level: 1, elapsedMs: 240, reducedMotion: true });
  const stillLater = calculatePlanetHubHoverFocus({ level: 1, elapsedMs: 1240, reducedMotion: true });

  assert.equal(idle.ringOpacity, 0);
  assert.equal(idle.beaconOpacity, 0);
  assert.equal(idle.lightIntensity, 0, "idle landmarks rely on motivated global light rather than permanent bulbs");
  assert.ok(active.ringOpacity > 0.5);
  assert.ok(active.lightIntensity > idle.lightIntensity);
  assert.equal(selected.ringOpacity, 0, "selection lights the facade without impersonating pointer hover");
  assert.ok(selected.lightIntensity > idle.lightIntensity, "the selected overview landmark remains visibly illuminated");
  assert.ok(selected.fillIntensity > idle.fillIntensity, "selection lifts the facade's shadow side");
  assert.ok(selected.rimIntensity > idle.rimIntensity, "selection separates the silhouette from space");
  assert.ok(selectedActive.lightIntensity > selected.lightIntensity, "hover can still accent the selected landmark");
  assert.equal(focused.ringOpacity, 0, "committed focus does not fake pointer-hover affordances");
  assert.ok(focused.lightIntensity > active.lightIntensity, "an unhovered focused facade remains clearly lit");
  assert.ok(focusedActive.lightIntensity > focused.lightIntensity, "hover can still accent an already focused landmark");
  assert.deepEqual(still, stillLater, "reduced motion uses a static affordance instead of pulsing");
});

test("selected and focused landmarks receive a balanced local facade rig", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function addLandmarkHoverEffect(");
  const end = source.indexOf("async function addLandmark(", start);
  assert.ok(start >= 0 && end > start, "the local landmark-light builder must remain inspectable");
  const builder = source.slice(start, end);
  assert.ok((builder.match(/new THREE[.]PointLight\(/g) || []).length >= 3,
    "one front-biased bulb leaves dark portal and Forge facades unreadable; use a local key/fill/rim rig");
  assert.match(builder, /lights:\s*\[[^\]]+\]/,
    "the complete local rig must remain associated with its destination effect");
  assert.ok(/effect[.]lights[.]forEach\(/.test(source) || /for\s*\([^)]*\bof effect[.]lights\)/.test(source),
    "selection and hover intensity updates must drive every light in the local rig");
  assert.match(source, /focusTarget\s*=\s*hubMode === "focused" && focusedDestination === destination \? 1 : 0/,
    "clearing pointer hover when focus starts must ramp the dedicated focus-light channel up");
  assert.match(source, /selectionTarget\s*=\s*committedDestination === destination \? 1 : 0/,
    "the committed overview destination must ramp its own stable facade-light channel");
  assert.match(source, /effect[.]selectionLevel\s*=\s*easeChannel[\s\S]*effect[.]focusLevel\s*=\s*easeChannel/,
    "selection and focus lighting must ease instead of snapping with semantic state");
});

test("landmark selection and focus channels interpolate balanced lighting", () => {
  const idle = calculatePlanetHubHoverFocus({ selected: 0, focused: 0, reducedMotion: true });
  const halfway = calculatePlanetHubHoverFocus({ selected: 0.5, focused: 0.5, reducedMotion: true });
  const active = calculatePlanetHubHoverFocus({ selected: 1, focused: 1, reducedMotion: true });
  for (const key of ["lightIntensity", "fillIntensity", "rimIntensity"]) {
    assert.ok(halfway[key] > idle[key], `${key} should rise above its idle floor`);
    assert.ok(halfway[key] < active[key], `${key} should remain below its fully focused value`);
  }
});

test("Moon landing geometry targets the visible surface with tail clearance instead of lunar center", () => {
  const moonCenter = [2.7, 0.18, -0.42];
  const approachFrom = [0, 0, 0];
  const moonRadius = 0.273;
  const tailClearance = 0.038;
  const landing = calculatePlanetHubMoonLandingGeometry({
    moonCenter,
    moonRadius,
    approachFrom,
    tailClearance
  });
  const distance = (left, right) => Math.hypot(...left.map((value, index) => value - right[index]));
  const approachDirection = approachFrom.map((value, index) => value - moonCenter[index]);
  const approachLength = Math.hypot(...approachDirection);
  const dot = landing.normal.reduce((total, value, index) => (
    total + value * approachDirection[index] / approachLength
  ), 0);

  assert.ok(Math.abs(distance(landing.surfacePosition, moonCenter) - moonRadius) < 1e-12,
    "the mathematical touchdown is exactly on the rendered Moon radius");
  assert.ok(Math.abs(distance(landing.landingPosition, moonCenter) - (moonRadius + tailClearance)) < 1e-12,
    "the tail pivot and active plume remain visibly above the lunar mesh");
  assert.ok(dot > 0.999999999, "the landing normal faces Earth/the launch origin");
  assert.ok(distance(landing.landingPosition, moonCenter) > 0.3,
    "a valid landing can never resolve to or pass through lunar center");

  const moved = calculatePlanetHubMoonLandingGeometry({
    moonCenter: [2.42, 0.24, -0.84],
    moonRadius,
    approachFrom,
    tailClearance
  });
  assert.notDeepEqual(moved.landingPosition, landing.landingPosition,
    "a changed orbital pose produces a correspondingly changed surface target");
  assert.ok(Math.abs(distance(moved.landingPosition, moved.center) - (moonRadius + tailClearance)) < 1e-12,
    "moving-Moon targets retain the exact surface-plus-clearance radius");
});

test("flight cinematography has explicit launch, chase, and landing phases", () => {
  const at = (elapsedMs) => calculatePlanetHubFlightPhase({ elapsedMs });
  assert.equal(at(0).name, "launch");
  assert.equal(at(1999).name, "launch");
  assert.equal(at(2000).name, "launch");
  assert.equal(at(2001).name, "chase");
  assert.equal(at(PLANET_HUB_JOURNEY_LANDING_CAMERA_START_MS - 1).name, "chase");
  assert.equal(at(PLANET_HUB_JOURNEY_LANDING_CAMERA_START_MS).name, "landing");
  assert.equal(at(PLANET_HUB_JOURNEY_LANDING_CAMERA_START_MS).landingBlend, 0);
  assert.equal(at(PLANET_HUB_JOURNEY_LANDING_CAMERA_START_MS + PLANET_HUB_JOURNEY_LANDING_CAMERA_BLEND_MS).landingBlend, 1);
  assert.equal(at(PLANET_HUB_JOURNEY_LANDING_START_MS - 1).landingLocked, false);
  assert.equal(at(PLANET_HUB_JOURNEY_LANDING_START_MS).landingLocked, true);
  assert.equal(at(PLANET_HUB_JOURNEY_DURATION_MS).landingProgress, 1);
  assert.equal(PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS, 2000);
  assert.equal(PLANET_HUB_JOURNEY_LANDING_STATIC_MS, 2000);
  assert.equal(PLANET_HUB_JOURNEY_DURATION_MS - PLANET_HUB_JOURNEY_LANDING_START_MS,
    PLANET_HUB_JOURNEY_LANDING_STATIC_MS);
});

test("reduced-motion Journey travel resolves to a crossfade instead of a compressed spatial route", () => {
  assert.deepEqual(resolvePlanetHubJourneyPresentation({
    direction: "outbound",
    reducedMotion: true
  }), {
    direction: "outbound",
    mode: "crossfade",
    durationMs: 0,
    ignitionMs: 0,
    holdCameraForHandoff: false,
    holdRocketForHandoff: true
  });
  assert.deepEqual(resolvePlanetHubJourneyPresentation({
    direction: "return",
    reducedMotion: true
  }), {
    direction: "return",
    mode: "crossfade",
    durationMs: 0,
    ignitionMs: 0,
    holdCameraForHandoff: false,
    holdRocketForHandoff: false
  });
  assert.deepEqual(resolvePlanetHubJourneyPresentation({
    direction: "return",
    reducedMotion: false
  }), {
    direction: "return",
    mode: "spatial",
    durationMs: PLANET_HUB_JOURNEY_DURATION_MS,
    ignitionMs: PLANET_HUB_JOURNEY_IGNITION_MS,
    holdCameraForHandoff: false,
    holdRocketForHandoff: false
  });
  assert.equal(
    resolvePlanetHubJourneyPresentation({ direction: "outbound" }).holdCameraForHandoff,
    true,
    "only the ordinary outbound film holds its arrival camera behind the project handoff"
  );
});

test("parallel transport carries an orthonormal camera and rocket frame without facade flips", () => {
  const directions = [
    [0.05, 0.99, 0.08],
    [0.24, 0.92, -0.3],
    [0.58, 0.5, -0.64],
    [0.73, -0.08, -0.68],
    [0.42, -0.66, -0.62],
    [-0.08, -0.96, -0.26]
  ];
  const dot = (left, right) => left.reduce((total, value, index) => total + value * right[index], 0);
  const cross = (left, right) => [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
  let frame = null;
  for (const direction of directions) {
    const next = calculatePlanetHubTransportedFrame({
      forward: direction,
      previousFrame: frame,
      preferredFacade: [0, 1, 0]
    });
    for (const axis of [next.facade, next.forward, next.side]) {
      assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-9);
    }
    assert.ok(Math.abs(dot(next.facade, next.forward)) < 1e-9);
    assert.ok(Math.abs(dot(next.side, next.forward)) < 1e-9);
    assert.ok(Math.abs(dot(next.facade, next.side)) < 1e-9);
    assert.ok(dot(cross(next.facade, next.forward), next.side) > 0.999999,
      "the carried basis remains right-handed for Three.js makeBasis");
    if (frame) assert.ok(dot(next.facade, frame.facade) > 0,
      "smooth route curvature never introduces a one-frame 180-degree facade flip");
    frame = next;
  }

  const reversed = calculatePlanetHubTransportedFrame({
    forward: frame.forward.map((value) => -value),
    previousFrame: frame
  });
  assert.ok(dot(reversed.facade, frame.facade) > 0.999999,
    "an exact route reversal uses the carried facade as its stable rotation axis");
});

test("landing camera remains outside the destination body and above its near-side hemisphere", () => {
  const destinationCenter = [2.7, 0.18, -0.42];
  const destinationRadius = 0.273;
  const landing = calculatePlanetHubSurfaceLandingGeometry({
    destinationCenter,
    destinationRadius,
    approachFrom: [0, 0, 0],
    tailClearance: 0.038
  });
  const frame = calculatePlanetHubTransportedFrame({
    forward: landing.normal.map((value) => -value),
    preferredFacade: [0, 1, 0]
  });
  const phase = calculatePlanetHubFlightPhase({ elapsedMs: PLANET_HUB_JOURNEY_LANDING_START_MS });
  const pose = calculatePlanetHubJourneyCameraPose({
    rocketPosition: landing.landingPosition,
    tangent: landing.normal.map((value) => -value),
    destinationCenter,
    destinationRadius,
    landingNormal: landing.normal,
    landingPosition: landing.landingPosition,
    flightPhase: phase,
    transportedFrame: frame,
    progress: PLANET_HUB_JOURNEY_LANDING_START_MS / PLANET_HUB_JOURNEY_DURATION_MS,
    ignitionShare: PLANET_HUB_JOURNEY_IGNITION_MS / PLANET_HUB_JOURNEY_DURATION_MS,
    launchViewHoldShare: PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS / PLANET_HUB_JOURNEY_DURATION_MS,
    followBlendShare: 860 / PLANET_HUB_JOURNEY_DURATION_MS
  });
  const offset = pose.position.map((value, index) => value - destinationCenter[index]);
  const radialDistance = Math.hypot(...offset);
  const hemisphereDistance = offset.reduce((total, value, index) => total + value * landing.normal[index], 0);
  assert.equal(pose.landingBlend, 1);
  assert.ok(radialDistance >= destinationRadius + Math.max(0.08, destinationRadius * 0.28) - 1e-9,
    "the complete landing shot stays outside the Moon instead of clipping through it");
  assert.ok(hemisphereDistance > 0,
    "the landing camera remains on the visible landing hemisphere, never below the Moon");
  assert.ok(pose.position.every(Number.isFinite));
  assert.ok(pose.target.every(Number.isFinite));

  const constrained = constrainPlanetHubCameraOutsideSphere({
    position: destinationCenter,
    center: destinationCenter,
    radius: destinationRadius,
    surfaceNormal: landing.normal,
    clearance: 0.1,
    minimumHemisphere: 0.2
  });
  assert.ok(Math.hypot(...constrained.map((value, index) => value - destinationCenter[index])) >= 0.373 - 1e-9,
    "even a degenerate center sample is projected to a safe exterior camera point");
});

test("landing camera stays on one stable approach side while the rocket turns upright", () => {
  const destinationCenter = [2.7, 0.18, -0.42];
  const landing = calculatePlanetHubSurfaceLandingGeometry({
    destinationCenter,
    destinationRadius: PLANET_HUB_MOON_RADIUS_RATIO,
    approachFrom: [0, 0, 0],
    tailClearance: 0.038
  });
  const frozenFrame = calculatePlanetHubTransportedFrame({
    forward: [0.42, 0.82, -0.38],
    preferredFacade: [0, 1, 0]
  });
  const liveFrames = [
    calculatePlanetHubTransportedFrame({ forward: [0.7, 0.2, -0.68], preferredFacade: [1, 0, 0] }),
    calculatePlanetHubTransportedFrame({ forward: landing.normal, preferredFacade: [-1, 0, 0] })
  ];
  const phase = calculatePlanetHubFlightPhase({ elapsedMs: PLANET_HUB_JOURNEY_DURATION_MS });
  const poses = liveFrames.map((transportedFrame) => calculatePlanetHubJourneyCameraPose({
    rocketPosition: landing.landingPosition,
    tangent: transportedFrame.forward,
    destinationCenter,
    destinationRadius: PLANET_HUB_MOON_RADIUS_RATIO,
    landingNormal: landing.normal,
    landingPosition: landing.landingPosition,
    flightPhase: phase,
    transportedFrame,
    landingCameraFrame: frozenFrame,
    progress: 1
  }));

  assert.ok(Math.hypot(...poses[0].position.map((value, index) => value - poses[1].position[index])) < 1e-12,
    "rocket attitude changes cannot swing the settled landing camera around the Moon");
  assert.ok(Math.hypot(...poses[0].target.map((value, index) => value - poses[1].target[index])) < 1e-12);
});

test("camera damping smooths both position and look target without overshoot", () => {
  const first = smoothPlanetHubCameraPose({
    currentPosition: [0, 0, 0],
    currentTarget: [0, 0, 0],
    desiredPosition: [10, 5, -2],
    desiredTarget: [3, 2, 1],
    deltaSeconds: 1 / 60
  });
  assert.ok(first.position[0] > 0 && first.position[0] < 10);
  assert.ok(first.target[0] > 0 && first.target[0] < 3);
  const second = smoothPlanetHubCameraPose({
    currentPosition: first.position,
    currentTarget: first.target,
    desiredPosition: [10, 5, -2],
    desiredTarget: [3, 2, 1],
    deltaSeconds: 1 / 60
  });
  assert.ok(second.position[0] > first.position[0] && second.position[0] < 10);
  assert.ok(second.target[0] > first.target[0] && second.target[0] < 3);
});

test("Journey departure holds for ignition, arcs toward the live target, and arrives at flight scale", () => {
  const launchNormal = [0.6, 0.8, 0];
  const start = calculatePlanetHubJourneyDeparturePose({
    from: [0, 0, 0],
    to: [2, 1, -1],
    progress: 0,
    launchNormal
  });
  const ascending = calculatePlanetHubJourneyDeparturePose({
    from: [0, 0, 0],
    to: [2, 1, -1],
    progress: Math.min(1, PLANET_HUB_JOURNEY_LAUNCH_LIFT_MS / PLANET_HUB_JOURNEY_DURATION_MS / 2),
    launchNormal,
    launchLiftShare: PLANET_HUB_JOURNEY_LAUNCH_LIFT_MS / PLANET_HUB_JOURNEY_DURATION_MS,
    launchLiftHeight: PLANET_HUB_JOURNEY_LAUNCH_LIFT_HEIGHT
  });
  const middle = calculatePlanetHubJourneyDeparturePose({
    from: [0, 0, 0],
    to: [2, 1, -1],
    progress: 0.6,
    launchNormal
  });
  const end = calculatePlanetHubJourneyDeparturePose({
    from: [0, 0, 0],
    to: [2, 1, -1],
    progress: 1,
    launchNormal
  });
  assert.ok(Math.abs(start.position[0]) < 1e-12, "ignition start stays anchored laterally at launch pad");
  assert.ok(Math.abs(start.position[2]) < 1e-12, "ignition start stays anchored forward at launch pad");
  assert.ok(start.position[1] >= 0, "ignition start never dips beneath the launch pad");
  assert.equal(start.ignition, true);
  assert.ok(ascending.position[1] > 0,
    "the first moments move upward off the launch normal before long-range transfer");
  assert.ok(middle.position[1] > 0.1, "the flight bends visibly above the straight Earth-to-Moon chord");
  assert.deepEqual(end.position, [2, 1, -1]);
  assert.ok(Math.abs(end.scale - 0.18) < 1e-9);
  for (const [label, pose] of [["ignition", start], ["flight", middle], ["arrival", end]]) {
    assert.equal(pose.tangent.length, 3, `${label} exposes a complete flight tangent`);
    assert.ok(pose.tangent.every(Number.isFinite), `${label} flight tangent remains finite`);
    assert.ok(Math.abs(Math.hypot(...pose.tangent) - 1) < 1e-9,
      `${label} flight tangent is normalized for stable rocket orientation`);
  }
  assert.ok(start.tangent.reduce((total, value, index) => total + value * launchNormal[index], 0) > 0.999999,
    "the rocket initially aims away from the launch pad along its authored surface normal");
});

test("Journey arrival descends tail-first and finishes upright on the Moon surface normal", () => {
  const moon = calculatePlanetHubMoonLandingGeometry({
    moonCenter: [2.7, 0.18, -0.42],
    moonRadius: 0.273,
    approachFrom: [0, 0, 0],
    tailClearance: 0.038
  });
  const arrival = calculatePlanetHubJourneyDeparturePose({
    from: [0.2, 0.95, 0.2],
    to: moon.landingPosition,
    launchNormal: [0.2, 0.96, 0.18],
    arrivalNormal: moon.normal,
    routeStretch: PLANET_HUB_JOURNEY_ROUTE_STRETCH,
    ignitionShare: PLANET_HUB_JOURNEY_IGNITION_MS / PLANET_HUB_JOURNEY_DURATION_MS,
    progress: 1
  });
  const dot = (left, right) => left.reduce((total, value, index) => total + value * right[index], 0);

  assert.deepEqual(arrival.position, moon.landingPosition);
  assert.ok(dot(arrival.tangent, moon.normal) < -0.999999,
    "the vehicle's position moves inward toward the lunar surface at touchdown");
  assert.ok(dot(arrival.orientation, moon.normal) > 0.999999,
    "the rocket's +Y/nose axis finishes outward along the Moon normal");
  assert.ok(dot(arrival.orientation, arrival.tangent) < -0.999999,
    "nose-out orientation plus inward velocity creates the intended tail-first descent");

  const antiparallel = calculatePlanetHubJourneyRocketUp({
    tangent: moon.normal.map((value) => -value),
    landingNormal: moon.normal,
    travel: 0.78,
    landingBlendStart: 0.7,
    landingBlendEnd: 0.86
  });
  assert.ok(antiparallel.every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(...antiparallel) - 1) < 1e-9,
    "the mid-flip orientation stays normalized even for exactly opposite travel and landing axes");
});

function createJourneyCinematicRouteFixture() {
  const earthCenter = [0, 0, 0];
  const earthRadius = 1;
  const earthDock = [0.18, 1.055, 0.14];
  const earthNormal = earthDock.map((value) => value / Math.hypot(...earthDock));
  const moonCenter = [2.75, 0.32, -0.65];
  const moonLanding = calculatePlanetHubSurfaceLandingGeometry({
    destinationCenter: moonCenter,
    destinationRadius: PLANET_HUB_MOON_RADIUS_RATIO,
    approachFrom: earthDock,
    tailClearance: 0.038
  });
  // Mirrors the committed low/standard rocket's effective Earth scale and the
  // renderer's explicit 18% lunar presentation scale.
  const earthVehicleHeight = 0.39;
  const moonVehicleHeight = earthVehicleHeight * 0.18;
  const routeAt = (direction, elapsedMs) => {
    const outbound = direction === "outbound";
    return calculatePlanetHubJourneyDeparturePose({
      from: outbound ? earthDock : moonLanding.landingPosition,
      to: outbound ? moonLanding.landingPosition : earthDock,
      departureCenter: outbound ? earthCenter : moonCenter,
      departureRadius: outbound ? earthRadius : PLANET_HUB_MOON_RADIUS_RATIO,
      destinationCenter: outbound ? moonCenter : earthCenter,
      destinationRadius: outbound ? PLANET_HUB_MOON_RADIUS_RATIO : earthRadius,
      direction,
      elapsedMs,
      durationMs: PLANET_HUB_JOURNEY_DURATION_MS,
      launchNormal: outbound ? earthNormal : moonLanding.normal,
      arrivalNormal: outbound ? moonLanding.normal : earthNormal,
      launchVehicleHeight: outbound ? earthVehicleHeight : moonVehicleHeight,
      arrivalVehicleHeight: outbound ? moonVehicleHeight : earthVehicleHeight,
      vehicleRadiusRatio: PLANET_HUB_JOURNEY_VEHICLE_RADIUS_RATIO,
      minimumBodyClearance: PLANET_HUB_JOURNEY_BODY_CLEARANCE,
      routeStretch: PLANET_HUB_JOURNEY_ROUTE_STRETCH,
      launchLiftHeight: PLANET_HUB_JOURNEY_LAUNCH_LIFT_HEIGHT,
      preOrbitRadians: PLANET_HUB_JOURNEY_HERO_ARC_RADIANS
    });
  };
  return {
    earthCenter,
    earthRadius,
    earthDock,
    earthNormal,
    moonCenter,
    moonLanding,
    earthVehicleHeight,
    moonVehicleHeight,
    routeAt
  };
}

test("Journey route uses a restrained Earth hero arc and continuous phase handoffs", () => {
  const { earthCenter, earthDock, routeAt } = createJourneyCinematicRouteFixture();
  const heroArcDegrees = PLANET_HUB_JOURNEY_HERO_ARC_RADIANS * 180 / Math.PI;
  assert.ok(heroArcDegrees >= 80 && heroArcDegrees <= 110,
    `the authored hero arc must stay between 80 and 110 degrees, received ${heroArcDegrees}`);
  assert.ok(PLANET_HUB_JOURNEY_HERO_ARC_RADIANS < Math.PI,
    "the Earth hero shot must never become a full or near-full orbit");

  let orbitRadians = 0;
  let previousDirection = null;
  for (let elapsedMs = PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS;
    elapsedMs <= PLANET_HUB_JOURNEY_OUTBOUND_ORBIT_END_MS;
    elapsedMs += 4) {
    const position = routeAt("outbound", elapsedMs).position;
    const radial = position.map((coordinate, index) => coordinate - earthCenter[index]);
    const radialLength = Math.hypot(...radial);
    const direction = radial.map((coordinate) => coordinate / radialLength);
    assert.ok(radialLength > Math.hypot(...earthDock),
      "the restrained hero arc stays clear of Earth's surface");
    if (previousDirection) {
      const dot = Math.max(-1, Math.min(1,
        direction.reduce((sum, value, index) => sum + value * previousDirection[index], 0)));
      orbitRadians += Math.acos(dot);
    }
    previousDirection = direction;
  }
  assert.ok(Math.abs(orbitRadians - PLANET_HUB_JOURNEY_HERO_ARC_RADIANS) < 0.02,
    `the rendered hero arc was ${(orbitRadians * 180 / Math.PI).toFixed(2)} degrees`);
  assert.ok(orbitRadians < Math.PI,
    "measured route geometry must not smuggle the removed 360-degree orbit back in");

  for (const direction of ["outbound", "return"]) {
    let previous = routeAt(direction, 0);
    let transitionCount = 0;
    for (let elapsedMs = 1; elapsedMs <= PLANET_HUB_JOURNEY_DURATION_MS; elapsedMs += 1) {
      const current = routeAt(direction, elapsedMs);
      if (current.phase !== previous.phase) {
        transitionCount += 1;
        const before = routeAt(direction, Math.max(0, elapsedMs - 1));
        const after = routeAt(direction, Math.min(PLANET_HUB_JOURNEY_DURATION_MS, elapsedMs + 1));
        const positionDelta = Math.hypot(...after.position.map((value, index) => value - before.position[index]));
        const tangentDot = before.tangent.reduce((sum, value, index) => sum + value * after.tangent[index], 0);
        const attitudeDot = before.orientation.reduce((sum, value, index) => sum + value * after.orientation[index], 0);
        assert.ok(positionDelta < 0.02,
          `${direction} ${previous.phase}->${current.phase} cut ${positionDelta.toFixed(6)} units`);
        assert.ok(tangentDot > 0.999,
          `${direction} ${previous.phase}->${current.phase} snapped the route tangent`);
        assert.ok(attitudeDot > 0.999,
          `${direction} ${previous.phase}->${current.phase} snapped the rocket attitude`);
        assert.ok(Math.abs(after.scale - before.scale) < 0.01,
          `${direction} ${previous.phase}->${current.phase} snapped the vehicle scale`);
      }
      previous = current;
    }
    assert.ok(transitionCount >= 6, `${direction} must expose every authored cinematic phase`);
  }
});

test("Journey sweep keeps the complete rocket capsule outside Earth and Moon in both directions", () => {
  const fixture = createJourneyCinematicRouteFixture();
  const falseSafePivot = [0, 1.01, 0];
  assert.ok(Math.hypot(...falseSafePivot) - fixture.earthRadius > 0,
    "the synthetic tail pivot is outside Earth");
  const falseSafeBody = calculatePlanetHubVehicleSphereClearance({
    position: falseSafePivot,
    orientation: [1, 0, 0],
    vehicleHeight: fixture.earthVehicleHeight,
    center: fixture.earthCenter,
    sphereRadius: fixture.earthRadius
  });
  assert.equal(falseSafeBody.vehicleRadius,
    fixture.earthVehicleHeight * PLANET_HUB_JOURNEY_VEHICLE_RADIUS_RATIO);
  assert.ok(falseSafeBody.clearance < 0,
    "whole-body clearance must detect a side-on capsule collision that pivot-only testing misses");

  const bodies = [
    ["Earth", fixture.earthCenter, fixture.earthRadius],
    ["Moon", fixture.moonCenter, PLANET_HUB_MOON_RADIUS_RATIO]
  ];
  for (const direction of ["outbound", "return"]) {
    for (let elapsedMs = 0; elapsedMs <= PLANET_HUB_JOURNEY_DURATION_MS; elapsedMs += 1) {
      const pose = fixture.routeAt(direction, elapsedMs);
      const vehicleHeight = fixture.earthVehicleHeight * pose.scale;
      for (const [name, center, sphereRadius] of bodies) {
        const clearance = calculatePlanetHubVehicleSphereClearance({
          position: pose.position,
          orientation: pose.orientation,
          vehicleHeight,
          center,
          sphereRadius
        });
        assert.ok(clearance.vehicleRadius > 0,
          `${direction} ${elapsedMs}ms must test rocket volume, not only its pivot`);
        assert.ok(clearance.clearance >= PLANET_HUB_JOURNEY_BODY_CLEARANCE - 1e-9,
          `${direction} rocket body breached ${name} by ${(-clearance.clearance).toFixed(6)} at ${elapsedMs}ms`);
      }
    }
  }
});

test("Journey camera preserves the grounded launch and locked final landing shots in both directions", () => {
  const fixture = createJourneyCinematicRouteFixture();
  const distance = (left, right) => Math.hypot(...left.map((value, index) => value - right[index]));
  assert.equal(PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS, 2000);
  assert.equal(PLANET_HUB_JOURNEY_LANDING_STATIC_MS, 2000);
  assert.equal(PLANET_HUB_JOURNEY_DURATION_MS - PLANET_HUB_JOURNEY_LANDING_START_MS,
    PLANET_HUB_JOURNEY_LANDING_STATIC_MS);

  for (const direction of ["outbound", "return"]) {
    const outbound = direction === "outbound";
    const cameraStartPosition = outbound ? [0, 0.08, 4.5] : [3.4, 1.1, -0.9];
    const cameraStartTarget = outbound ? fixture.earthDock : fixture.moonLanding.landingPosition;
    const cameraStartUp = outbound ? [0, 1, 0] : fixture.moonLanding.normal;
    const elapsedTimes = [
      0,
      999,
      PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS - 1,
      PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS,
      PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS + 1,
      PLANET_HUB_JOURNEY_LANDING_START_MS,
      PLANET_HUB_JOURNEY_LANDING_START_MS + 500,
      PLANET_HUB_JOURNEY_DURATION_MS - 1,
      PLANET_HUB_JOURNEY_DURATION_MS
    ];
    let transportedFrame = null;
    const samples = new Map();
    for (const elapsedMs of elapsedTimes) {
      const rocket = fixture.routeAt(direction, elapsedMs);
      transportedFrame = calculatePlanetHubTransportedFrame({
        forward: rocket.tangent,
        previousFrame: transportedFrame,
        preferredFacade: [0, 0, 1]
      });
      const camera = calculatePlanetHubJourneyCameraPose({
        rocketPosition: rocket.position,
        tangent: rocket.tangent,
        earthCenter: fixture.earthCenter,
        earthRadius: fixture.earthRadius,
        destinationCenter: outbound ? fixture.moonCenter : fixture.earthCenter,
        destinationRadius: outbound ? PLANET_HUB_MOON_RADIUS_RATIO : fixture.earthRadius,
        landingNormal: outbound ? fixture.moonLanding.normal : fixture.earthNormal,
        landingPosition: outbound ? fixture.moonLanding.landingPosition : fixture.earthDock,
        landingFacade: [0, 0, 1],
        launchNormal: outbound ? fixture.earthNormal : fixture.moonLanding.normal,
        flightPhase: calculatePlanetHubFlightPhase({ elapsedMs }),
        transportedFrame,
        elapsedMs,
        durationMs: PLANET_HUB_JOURNEY_DURATION_MS,
        journeyDirection: direction,
        progress: elapsedMs / PLANET_HUB_JOURNEY_DURATION_MS,
        cameraStartPosition,
        cameraStartTarget,
        cameraStartUp,
        stableUp: cameraStartUp,
        vehicleHeight: fixture.earthVehicleHeight * rocket.scale,
        arrivalVehicleHeight: outbound ? fixture.moonVehicleHeight : fixture.earthVehicleHeight,
        ignitionShare: PLANET_HUB_JOURNEY_IGNITION_MS / PLANET_HUB_JOURNEY_DURATION_MS,
        launchViewHoldShare: PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS / PLANET_HUB_JOURNEY_DURATION_MS
      });
      samples.set(elapsedMs, { rocket, camera });
    }

    for (const elapsedMs of [0, 999, 1999, 2000]) {
      const sample = samples.get(elapsedMs);
      assert.deepEqual(sample.camera.position, cameraStartPosition,
        `${direction} camera must remain grounded through ${elapsedMs}ms`);
      assert.equal(sample.camera.stage, "ground-launch");
    }
    assert.ok(distance(samples.get(2001).camera.position, cameraStartPosition) < 0.01,
      `${direction} chase must ease away from the grounded shot without a cut`);

    const locked = samples.get(PLANET_HUB_JOURNEY_LANDING_START_MS);
    assert.equal(locked.camera.stage, "landing-locked");
    for (const elapsedMs of [
      PLANET_HUB_JOURNEY_LANDING_START_MS + 500,
      PLANET_HUB_JOURNEY_DURATION_MS - 1,
      PLANET_HUB_JOURNEY_DURATION_MS
    ]) {
      const sample = samples.get(elapsedMs);
      assert.equal(sample.camera.stage, "landing-locked");
      assert.ok(distance(sample.camera.position, locked.camera.position) < 1e-12,
        `${direction} final landing camera position moved at ${elapsedMs}ms`);
      assert.ok(distance(sample.camera.target, locked.camera.target) < 1e-12,
        `${direction} final landing camera target moved at ${elapsedMs}ms`);
      assert.ok(distance(sample.camera.up, locked.camera.up) < 1e-12,
        `${direction} final landing camera rolled at ${elapsedMs}ms`);
    }
    assert.ok(distance(locked.rocket.position,
      samples.get(PLANET_HUB_JOURNEY_DURATION_MS).rocket.position) > 0.01,
    `${direction} rocket must visibly descend while the final camera remains static`);
  }
});

test("Moon return samples the exact outbound route in reverse", () => {
  const earthCenter = [0, 0, 0];
  const earthRadius = 1;
  const earthDock = [0.18, 1.055, 0.14];
  const earthLength = Math.hypot(...earthDock);
  const earthNormal = earthDock.map((value) => value / earthLength);
  const moonCenter = [2.75, 0.32, -0.65];
  const moonLanding = calculatePlanetHubMoonLandingGeometry({
    moonCenter,
    moonRadius: PLANET_HUB_MOON_RADIUS_RATIO,
    approachFrom: earthDock,
    tailClearance: 0.038
  });
  const earthVehicleHeight = 0.39;
  const moonVehicleHeight = earthVehicleHeight * 0.18;
  const outboundAt = (elapsedMs) => calculatePlanetHubJourneyDeparturePose({
    from: earthDock,
    to: moonLanding.landingPosition,
    departureCenter: earthCenter,
    departureRadius: earthRadius,
    destinationCenter: moonCenter,
    destinationRadius: PLANET_HUB_MOON_RADIUS_RATIO,
    direction: "outbound",
    elapsedMs,
    durationMs: PLANET_HUB_JOURNEY_DURATION_MS,
    launchNormal: earthNormal,
    arrivalNormal: moonLanding.normal,
    launchVehicleHeight: earthVehicleHeight,
    arrivalVehicleHeight: moonVehicleHeight,
    vehicleRadiusRatio: PLANET_HUB_JOURNEY_VEHICLE_RADIUS_RATIO,
    minimumBodyClearance: PLANET_HUB_JOURNEY_BODY_CLEARANCE,
    routeStretch: PLANET_HUB_JOURNEY_ROUTE_STRETCH,
    launchLiftHeight: PLANET_HUB_JOURNEY_LAUNCH_LIFT_HEIGHT,
    preOrbitRadians: PLANET_HUB_JOURNEY_HERO_ARC_RADIANS
  });
  const returnAt = (elapsedMs) => calculatePlanetHubJourneyDeparturePose({
    from: moonLanding.landingPosition,
    to: earthDock,
    departureCenter: moonCenter,
    departureRadius: PLANET_HUB_MOON_RADIUS_RATIO,
    destinationCenter: earthCenter,
    destinationRadius: earthRadius,
    direction: "return",
    elapsedMs,
    durationMs: PLANET_HUB_JOURNEY_DURATION_MS,
    launchNormal: moonLanding.normal,
    arrivalNormal: earthNormal,
    launchVehicleHeight: moonVehicleHeight,
    arrivalVehicleHeight: earthVehicleHeight,
    vehicleRadiusRatio: PLANET_HUB_JOURNEY_VEHICLE_RADIUS_RATIO,
    minimumBodyClearance: PLANET_HUB_JOURNEY_BODY_CLEARANCE,
    routeStretch: PLANET_HUB_JOURNEY_ROUTE_STRETCH,
    launchLiftHeight: PLANET_HUB_JOURNEY_LAUNCH_LIFT_HEIGHT,
    preOrbitRadians: PLANET_HUB_JOURNEY_HERO_ARC_RADIANS
  });

  for (let elapsedMs = 0; elapsedMs <= PLANET_HUB_JOURNEY_DURATION_MS; elapsedMs += 50) {
    const outbound = outboundAt(PLANET_HUB_JOURNEY_DURATION_MS - elapsedMs);
    const returning = returnAt(elapsedMs);
    assert.ok(Math.hypot(...returning.position.map((value, index) => value - outbound.position[index])) < 1e-9,
      `return route diverged from the canonical path at ${elapsedMs}ms`);
    assert.ok(returning.tangent.reduce((sum, value, index) => sum + value * outbound.tangent[index], 0) < -0.999999,
      `return tangent did not reverse the canonical path at ${elapsedMs}ms`);
    assert.ok(Math.abs((returning.scaleProgress + outbound.scaleProgress) - 1) < 1e-9,
      `vehicle scale did not reverse continuously at ${elapsedMs}ms`);
  }
});

test("Moon return launch stays continuous through every early route and camera handoff", async (t) => {
  const subtract = (left, right) => left.map((value, index) => value - right[index]);
  const magnitude = (vector) => Math.hypot(...vector);
  const normalize = (vector, fallback = [1, 0, 0]) => {
    const length = magnitude(vector);
    return length > 1e-12 ? vector.map((value) => value / length) : fallback;
  };
  const dot = (left, right) => left.reduce((sum, value, index) => (
    sum + value * right[index]
  ), 0);
  const angularDelta = (left, right) => Math.acos(Math.max(-1, Math.min(1,
    dot(normalize(left), normalize(right))
  ))) * 180 / Math.PI;
  const cameraBasis = (camera) => {
    const view = normalize(subtract(camera.target, camera.position));
    const projectedUp = subtract(camera.up, view.map((value) => value * dot(camera.up, view)));
    return {
      view,
      projectedUpLength: magnitude(projectedUp),
      screenUp: normalize(projectedUp, [0, 1, 0])
    };
  };

  const earthCenter = [0, 0, 0];
  const earthRadius = 1;
  const earthDock = [0.18, 1.055, 0.14];
  const earthNormal = normalize(earthDock);
  const moonCenter = [2.75, 0.32, -0.65];
  const lunarLanding = calculatePlanetHubSurfaceLandingGeometry({
    destinationCenter: moonCenter,
    destinationRadius: PLANET_HUB_MOON_RADIUS_RATIO,
    approachFrom: earthDock,
    tailClearance: 0.038
  });
  const cameraStartPosition = [3.4, 1.1, -0.9];
  const cameraStartTarget = lunarLanding.landingPosition;
  const earlyBoundaries = [
    {
      name: "ignition-to-lift",
      elapsedMs: PLANET_HUB_JOURNEY_IGNITION_MS,
      before: { rocket: "ignition", camera: "ground-launch" },
      after: { rocket: "lift", camera: "ground-launch" }
    },
    {
      name: "ground-launch-to-chase",
      elapsedMs: PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS,
      before: { rocket: "lift", camera: "ground-launch" },
      after: { rocket: "approach", camera: "lunar-departure" }
    },
    {
      name: "lunar-approach-to-transfer",
      elapsedMs: PLANET_HUB_JOURNEY_DURATION_MS - PLANET_HUB_JOURNEY_APPROACH_START_MS,
      before: { rocket: "approach", camera: "lunar-departure" },
      after: { rocket: "transfer", camera: "lunar-departure" }
    },
    {
      name: "lunar-camera-handoff-to-transfer",
      elapsedMs: PLANET_HUB_JOURNEY_RETURN_HANDOFF_END_MS,
      before: { rocket: "transfer", camera: "lunar-departure" },
      after: { rocket: "transfer", camera: "transfer" }
    }
  ];

  // Sample the complete return departure in chronological order so the
  // transported frame has the same history it receives from the render loop.
  const elapsedTimes = new Set();
  for (let elapsedMs = 0; elapsedMs <= PLANET_HUB_JOURNEY_RETURN_HANDOFF_END_MS + 16; elapsedMs += 8) {
    elapsedTimes.add(elapsedMs);
  }
  for (const boundary of earlyBoundaries) {
    elapsedTimes.add(boundary.elapsedMs - 1);
    elapsedTimes.add(boundary.elapsedMs);
    elapsedTimes.add(boundary.elapsedMs + 1);
  }
  let transportedFrame = null;
  const samples = new Map();
  for (const elapsedMs of [...elapsedTimes].sort((left, right) => left - right)) {
    const progress = elapsedMs / PLANET_HUB_JOURNEY_DURATION_MS;
    const rocket = calculatePlanetHubJourneyDeparturePose({
      from: lunarLanding.landingPosition,
      to: earthDock,
      departureCenter: moonCenter,
      destinationCenter: earthCenter,
      destinationRadius: earthRadius,
      direction: "return",
      progress,
      elapsedMs,
      durationMs: PLANET_HUB_JOURNEY_DURATION_MS,
      launchNormal: lunarLanding.normal,
      arrivalNormal: earthNormal,
      routeStretch: PLANET_HUB_JOURNEY_ROUTE_STRETCH,
      ignitionShare: PLANET_HUB_JOURNEY_IGNITION_MS / PLANET_HUB_JOURNEY_DURATION_MS,
      launchLiftHeight: PLANET_HUB_JOURNEY_LAUNCH_LIFT_HEIGHT
    });
    transportedFrame = calculatePlanetHubTransportedFrame({
      forward: rocket.tangent,
      previousFrame: transportedFrame,
      preferredFacade: [0, 0, 1]
    });
    const camera = calculatePlanetHubJourneyCameraPose({
      rocketPosition: rocket.position,
      tangent: rocket.tangent,
      earthCenter,
      earthRadius,
      destinationCenter: earthCenter,
      destinationRadius: earthRadius,
      landingNormal: earthNormal,
      landingPosition: earthDock,
      landingFacade: [0, 0, 1],
      launchNormal: lunarLanding.normal,
      flightPhase: calculatePlanetHubFlightPhase({
        elapsedMs,
        landingCameraStartMs: 7850,
        landingCameraBlendMs: 750
      }),
      transportedFrame,
      elapsedMs,
      journeyDirection: "return",
      progress,
      cameraStartPosition,
      cameraStartTarget,
      cameraStartUp: lunarLanding.normal,
      stableUp: lunarLanding.normal,
      vehicleHeight: 0.08,
      arrivalVehicleHeight: 0.32,
      ignitionShare: PLANET_HUB_JOURNEY_IGNITION_MS / PLANET_HUB_JOURNEY_DURATION_MS,
      launchViewHoldShare: PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS / PLANET_HUB_JOURNEY_DURATION_MS,
      followBlendShare: 860 / PLANET_HUB_JOURNEY_DURATION_MS
    });
    samples.set(elapsedMs, {
      rocket,
      camera,
      basis: cameraBasis(camera)
    });
  }

  for (const boundary of earlyBoundaries) {
    const before = samples.get(boundary.elapsedMs - 1);
    const after = samples.get(boundary.elapsedMs + 1);
    assert.equal(before.rocket.phase, boundary.before.rocket,
      `${boundary.name} must start at the expected return route phase`);
    assert.equal(after.rocket.phase, boundary.after.rocket,
      `${boundary.name} must finish at the expected return route phase`);
    assert.equal(before.camera.stage, boundary.before.camera,
      `${boundary.name} must start at the expected camera stage`);
    assert.equal(after.camera.stage, boundary.after.camera,
      `${boundary.name} must finish at the expected camera stage`);
  }

  await t.test("camera and rocket positions do not cut", () => {
    for (const boundary of earlyBoundaries) {
      const before = samples.get(boundary.elapsedMs - 1);
      const after = samples.get(boundary.elapsedMs + 1);
      const cameraDelta = magnitude(subtract(after.camera.position, before.camera.position));
      const rocketDelta = magnitude(subtract(after.rocket.position, before.rocket.position));
      assert.ok(cameraDelta < 0.02,
        `${boundary.name} camera moved ${cameraDelta.toFixed(6)} world units across 2ms`);
      assert.ok(rocketDelta < 0.01,
        `${boundary.name} rocket moved ${rocketDelta.toFixed(6)} world units across 2ms`);
    }
  });

  await t.test("view direction does not whip", () => {
    for (const boundary of earlyBoundaries) {
      const before = samples.get(boundary.elapsedMs - 1);
      const after = samples.get(boundary.elapsedMs + 1);
      const viewDelta = angularDelta(before.basis.view, after.basis.view);
      assert.ok(viewDelta < 1,
        `${boundary.name} view direction rotated ${viewDelta.toFixed(3)} degrees across 2ms`);
    }
  });

  await t.test("the complete lunar camera handoff stays cinematic rather than merely continuous", () => {
    const ordered = [...samples.entries()]
      .filter(([elapsedMs]) => elapsedMs <= PLANET_HUB_JOURNEY_RETURN_HANDOFF_END_MS)
      .sort(([left], [right]) => left - right);
    let peakViewSpeed = 0;
    let peakUpSpeed = 0;
    for (let index = 1; index < ordered.length; index += 1) {
      const [previousMs, previous] = ordered[index - 1];
      const [currentMs, current] = ordered[index];
      const deltaSeconds = (currentMs - previousMs) / 1000;
      if (deltaSeconds <= 0) continue;
      peakViewSpeed = Math.max(peakViewSpeed,
        angularDelta(previous.basis.view, current.basis.view) / deltaSeconds);
      peakUpSpeed = Math.max(peakUpSpeed,
        angularDelta(previous.basis.screenUp, current.basis.screenUp) / deltaSeconds);
    }
    assert.ok(peakViewSpeed < 100,
      `return departure view peaked at ${peakViewSpeed.toFixed(2)} degrees per second`);
    assert.ok(peakUpSpeed < 65,
      `return departure roll peaked at ${peakUpSpeed.toFixed(2)} degrees per second`);
  });

  await t.test("camera up remains nonsingular and does not roll", () => {
    for (const boundary of earlyBoundaries) {
      const before = samples.get(boundary.elapsedMs - 1);
      const after = samples.get(boundary.elapsedMs + 1);
      assert.ok(before.basis.projectedUpLength > 0.2 && after.basis.projectedUpLength > 0.2,
        `${boundary.name} cannot approach a lookAt up-vector singularity`);
      const upDelta = angularDelta(before.camera.up, after.camera.up);
      const screenUpDelta = angularDelta(before.basis.screenUp, after.basis.screenUp);
      assert.ok(upDelta < 2,
        `${boundary.name} camera up rotated ${upDelta.toFixed(3)} degrees across 2ms`);
      assert.ok(screenUpDelta < 2,
        `${boundary.name} rendered screen-up rotated ${screenUpDelta.toFixed(3)} degrees across 2ms`);
    }
  });

  await t.test("rocket attitude does not snap", () => {
    for (const boundary of earlyBoundaries) {
      const before = samples.get(boundary.elapsedMs - 1);
      const after = samples.get(boundary.elapsedMs + 1);
      const attitudeDelta = angularDelta(before.rocket.orientation, after.rocket.orientation);
      assert.ok(attitudeDelta < 1,
        `${boundary.name} rocket attitude rotated ${attitudeDelta.toFixed(3)} degrees across 2ms`);
    }
  });
});

test("Journey camera keeps launch planted and composes deterministic transfer and landing rigs", () => {
  const cameraStartPosition = [0, 0.08, 4.5];
  const cameraStartTarget = [0, 0, 0];
  const moonPosition = [2.8, 1.4, -2.2];
  const ignition = calculatePlanetHubJourneyCameraPose({
    rocketPosition: [0, 1, 0],
    tangent: [0, 1, 0],
    moonPosition,
    elapsedMs: 1000,
    progress: 1000 / PLANET_HUB_JOURNEY_DURATION_MS,
    cameraStartPosition,
    cameraStartTarget,
    launchNormal: [0, 1, 0],
    vehicleHeight: 0.32
  });
  assert.deepEqual(ignition.position, cameraStartPosition,
    "ignition holds the established focused camera instead of flashing to a new shot");
  assert.ok(ignition.target[1] > cameraStartTarget[1],
    "the planted launch camera may pan upward to keep the lifting rocket framed");
  assert.equal(ignition.follow, 0);
  assert.equal(ignition.stage, "ground-launch");

  const rocketPosition = [1.15, 1.8, -0.7];
  const tangent = [0.8, 0.36, -0.48];
  const tangentLength = Math.hypot(...tangent);
  const direction = tangent.map((value) => value / tangentLength);
  const transfer = calculatePlanetHubJourneyCameraPose({
    rocketPosition,
    tangent,
    moonPosition,
    destinationCenter: moonPosition,
    earthCenter: [0, 0, 0],
    earthRadius: 1,
    elapsedMs: 4800,
    progress: 4800 / PLANET_HUB_JOURNEY_DURATION_MS,
    cameraStartPosition,
    cameraStartTarget,
    transportedFrame: calculatePlanetHubTransportedFrame({ forward: tangent }),
    vehicleHeight: 0.32,
    arrivalVehicleHeight: 0.08
  });
  assert.ok(transfer.follow > 0 && transfer.follow <= 1,
    "the camera blends into its chase rig after ignition");
  assert.equal(transfer.stage, "transfer");
  assert.ok(transfer.position.every(Number.isFinite));
  assert.ok(transfer.target.every(Number.isFinite));
  const targetFromRocket = transfer.target.map((value, index) => value - rocketPosition[index]);
  const dot = (a, b) => a.reduce((total, value, index) => total + value * b[index], 0);
  assert.ok(dot(targetFromRocket, direction) > 0,
    "the camera looks ahead along the rocket's actual travel direction");
  assert.ok(Math.hypot(...transfer.position) >= 1.08,
    "the transfer rig cannot place the camera inside Earth");

  const arrival = calculatePlanetHubJourneyCameraPose({
    rocketPosition: moonPosition,
    tangent: direction,
    moonPosition,
    destinationCenter: [2.8, 1.1, -2.2],
    destinationRadius: 0.273,
    landingNormal: [0, 1, 0],
    landingPosition: moonPosition,
    landingFacade: [0, 0, 1],
    elapsedMs: 9200,
    progress: 1,
    cameraStartPosition,
    cameraStartTarget,
    vehicleHeight: 0.08,
    arrivalVehicleHeight: 0.08
  });
  assert.ok(arrival.position.every(Number.isFinite), "arrival camera position never produces NaN/Infinity");
  assert.ok(arrival.target.every(Number.isFinite), "arrival camera target never produces NaN/Infinity");
  assert.ok(Number.isFinite(arrival.follow));
  assert.equal(arrival.stage, "landing-locked");
});

test("Journey camera holds the exact front launch view for two full seconds before chasing", () => {
  const cameraStartPosition = [0, 0.08, 4.5];
  const cameraStartTarget = [0, 0, 0];
  const common = {
    rocketPosition: [0.3, 1.4, 0.1],
    tangent: [0.2, 0.96, -0.18],
    moonPosition: [2.7, 0.18, -0.42],
    cameraStartPosition,
    cameraStartTarget,
    ignitionShare: PLANET_HUB_JOURNEY_IGNITION_MS / PLANET_HUB_JOURNEY_DURATION_MS,
    launchViewHoldShare: PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS / PLANET_HUB_JOURNEY_DURATION_MS,
    followBlendShare: 860 / PLANET_HUB_JOURNEY_DURATION_MS
  };
  const before = calculatePlanetHubJourneyCameraPose({
    ...common,
    progress: 1999 / PLANET_HUB_JOURNEY_DURATION_MS
  });
  const boundary = calculatePlanetHubJourneyCameraPose({
    ...common,
    progress: 2000 / PLANET_HUB_JOURNEY_DURATION_MS
  });
  const after = calculatePlanetHubJourneyCameraPose({
    ...common,
    progress: 2001 / PLANET_HUB_JOURNEY_DURATION_MS
  });
  const blended = calculatePlanetHubJourneyCameraPose({
    ...common,
    progress: 2430 / PLANET_HUB_JOURNEY_DURATION_MS
  });

  for (const pose of [before, boundary]) {
    assert.deepEqual(pose.position, cameraStartPosition);
    assert.ok(pose.target[1] > cameraStartTarget[1],
      "the fixed launch camera smoothly tilts upward with the ascending rocket");
    assert.equal(pose.follow, 0);
    assert.equal(pose.stage, "ground-launch");
  }
  assert.ok(boundary.target[1] >= before.target[1],
    "the two-second launch pan remains monotonic at the camera handoff");
  assert.ok(after.follow > 0, "the chase blend starts only after the complete 2.0-second launch view");
  assert.ok(blended.follow > after.follow && blended.follow < 1,
    "the cut-free 860ms transition eases progressively into the moving chase rig");
  assert.equal(PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS, 2000);
  assert.equal(PLANET_HUB_JOURNEY_DURATION_MS,
    PLANET_HUB_JOURNEY_LANDING_START_MS + PLANET_HUB_JOURNEY_LANDING_STATIC_MS);
});

test("Journey departure is camera-led and applies the rocket flight orientation", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  assert.match(source, /moonJourneyDock\s*=\s*new THREE[.]Group\(\)/,
    "the authored Moon landing pad must use a constructor exposed by the pinned lightweight Three runtime");
  assert.doesNotMatch(source, /moonJourneyDock\s*=\s*new THREE[.]Object3D\(\)/,
    "an unavailable Object3D constructor must not silently remove the Moon landing pad");
  assert.match(source, /hubMode === "overview"[\s\S]*?!pointerDragActive[\s\S]*?!journeyDeparture[\s\S]*?!bodyFocusTransition/,
    "the physical world must remain frozen while a detached rocket targets its authored landing pad");
  const playStart = source.indexOf("function beginJourneyFlight(");
  const settleStart = source.indexOf("function settleJourneyDeparture(", playStart);
  assert.ok(playStart >= 0 && settleStart > playStart);
  const play = source.slice(playStart, settleStart);
  assert.doesNotMatch(play, /startPresentationTransition\([\s\S]*?kind:\s*["']journey-departure["']/,
    "launch must not zoom the complete Earth back to overview before the rocket leaves");

  const departureStart = source.indexOf("if (journeyDeparture) {");
  const departureEnd = source.indexOf("if (hubMode === \"overview\"", departureStart);
  assert.ok(departureStart >= 0 && departureEnd > departureStart);
  const frame = source.slice(departureStart, departureEnd);
  assert.match(frame, /journeyRocket[.]quaternion/,
    "every flight frame must orient the rocket from the calculated path tangent");
  assert.match(frame, /calculatePlanetHubJourneyCameraPose\(/,
    "every flight frame must calculate a camera chase pose from the live rocket and Moon positions");
  assert.match(frame, /calculatePlanetHubFlightPhase\(/,
    "the renderer must author launch, chase, and landing as explicit phases");
  assert.match(frame, /calculatePlanetHubTransportedFrame\(/,
    "camera and rocket attitude must carry a stable frame through route curvature");
  assert.match(frame, /const appliedCameraPose\s*=\s*desiredCameraPose/,
    "explicit camera rigs must be applied deterministically without a cadence-dependent lag filter");
  assert.doesNotMatch(frame, /smoothPlanetHubCameraPose\(/,
    "a second per-frame damper cannot lag behind orbit and whip into the landing rig");
  assert.match(source, /export function calculatePlanetHubJourneyCameraPose\([\s\S]*?constrainPlanetHubCameraOutsideSphere\(/,
    "the lunar landing camera must be clamped outside the destination body");
  assert.match(play, /calculatePlanetHubMoonLandingGeometry\(/,
    "flight setup must resolve a scaled near-side lunar surface target instead of Moon center");
  assert.match(frame, /arrivalNormal:\s*activeDeparture[.]arrivalNormal[.]toArray\(\)/,
    "the generic path solver must receive the stored destination surface normal for its descent handle");
  assert.match(frame, /orientationLocal\s*=\s*new THREE[.]Vector3\(\.\.\.pose[.]orientation\)/,
    "the rocket's +Y axis must rotate from cruise tangent to the outward landing normal");
  assert.doesNotMatch(frame, /to:\s*(?:liveTargetPosition|liveMoonCenter)[.]toArray\(\)/,
    "the route endpoint must never be the Moon center");
  assert.match(frame, /camera[.]position/,
    "the renderer must apply the chase position to the live camera");
  assert.match(frame, /camera[.]lookAt\(/,
    "the renderer must aim the camera through the rocket toward its destination");
  assert.match(play, /function playJourneyReturn\([\s\S]*?fromWorld\s*=\s*["']moon["'][\s\S]*?toWorld\s*=\s*["']earth["']/,
    "the renderer exposes the direction-safe Moon-to-Earth return contract");
  assert.match(source, /resolvePlanetHubAsset\(manifest,\s*["']moon["'],\s*quality,\s*["']journey["']\)/,
    "the actual Moon landing platform is loaded into the Earth flight scene");
  assert.match(play, /moonJourneyDock[.]getWorldPosition\([\s\S]*?moonDockPosition\s*=\s*celestialSystem[.]worldToLocal/,
    "the Moon endpoint is the authored rocket-dock socket rather than an approximate globe point");
  assert.match(play, /if \(returning\)[\s\S]*?fromPosition\s*=\s*moonDockPosition[.]clone\(\)/,
    "return travel begins from the same exact Moon pad socket used by outbound touchdown");
  assert.match(play, /toPosition\s*=\s*earthDockPosition[.]clone\(\)[\s\S]*?arrivalNormal\s*=\s*earthNormal[.]clone\(\)/,
    "Moon-to-Earth travel lands at the exact preserved dock with Earth's saved outward normal");
  assert.match(source, /\bplayJourneyReturn,\s*\n\s*cancelJourneyDeparture/,
    "the public renderer object must expose the return flight promise");
});

test("reverse touchdown restores the exact Earth dock and canonical Home camera", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function settleJourneyDeparture(");
  const end = source.indexOf("function cancelJourneyDeparture(", start);
  assert.ok(start >= 0 && end > start, "Journey settlement must remain inspectable");
  const settle = source.slice(start, end);
  assert.match(settle, /originalParent[.]add[?][.]\(journeyRocket\)[\s\S]*?position[.]copy\(activeDeparture[.]dockPosition\)[\s\S]*?quaternion[.]copy\(activeDeparture[.]dockQuaternion\)[\s\S]*?scale[.]copy\(activeDeparture[.]dockScale\)/,
    "return arrival must reparent and restore the exact authored Earth dock transform");
  assert.match(settle, /holdCamera\s*=\s*Boolean\(completed && activeDeparture[.]holdCameraForHandoff\)/,
    "camera retention must be an explicit direction-aware flight contract");
  assert.match(settle, /journeyCameraHeldForHandoff\s*=\s*holdCamera[\s\S]*?if \(!completed \|\| !holdCamera\) restoreHomeCamera\(\)/,
    "reverse completion must restore the canonical Earth overview instead of retaining the landing camera");

  const planner = resolvePlanetHubJourneyPresentation({ direction: "return" });
  assert.equal(planner.holdCameraForHandoff, false);
  assert.equal(planner.holdRocketForHandoff, false);
});

test("reverse flight samples keep a continuous camera outside Earth and finish upright on the dock", () => {
  const earthCenter = [0, 0, 0];
  const earthRadius = 1;
  const earthDock = [0.18, 1.055, 0.14];
  const earthDockLength = Math.hypot(...earthDock);
  const earthNormal = earthDock.map((value) => value / earthDockLength);
  const lunarLanding = calculatePlanetHubSurfaceLandingGeometry({
    destinationCenter: [2.75, 0.32, -0.65],
    destinationRadius: PLANET_HUB_MOON_RADIUS_RATIO,
    approachFrom: earthDock,
    tailClearance: 0.038
  });
  const cameraStartPosition = [3.4, 1.1, -0.9];
  const cameraStartTarget = lunarLanding.landingPosition;
  const elapsedSamples = [0, 1999, 2000, 2001, 3600, 5350, 7000, 7600, 8600, 10600];
  let transportedFrame = null;
  const samples = elapsedSamples.map((elapsedMs) => {
    const progress = elapsedMs / PLANET_HUB_JOURNEY_DURATION_MS;
    const rocket = calculatePlanetHubJourneyDeparturePose({
      from: lunarLanding.landingPosition,
      to: earthDock,
      departureCenter: [2.75, 0.32, -0.65],
      destinationCenter: earthCenter,
      destinationRadius: earthRadius,
      direction: "return",
      progress,
      elapsedMs,
      durationMs: PLANET_HUB_JOURNEY_DURATION_MS,
      launchNormal: lunarLanding.normal,
      arrivalNormal: earthNormal,
      routeStretch: PLANET_HUB_JOURNEY_ROUTE_STRETCH,
      ignitionShare: PLANET_HUB_JOURNEY_IGNITION_MS / PLANET_HUB_JOURNEY_DURATION_MS,
      launchLiftHeight: PLANET_HUB_JOURNEY_LAUNCH_LIFT_HEIGHT
    });
    transportedFrame = calculatePlanetHubTransportedFrame({
      forward: rocket.tangent,
      previousFrame: transportedFrame,
      preferredFacade: [0, 0, 1]
    });
    const flightPhase = calculatePlanetHubFlightPhase({
      elapsedMs,
      landingCameraStartMs: 7850,
      landingCameraBlendMs: 750
    });
    const camera = calculatePlanetHubJourneyCameraPose({
      rocketPosition: rocket.position,
      tangent: rocket.tangent,
      earthCenter,
      earthRadius,
      destinationCenter: earthCenter,
      destinationRadius: earthRadius,
      landingNormal: earthNormal,
      landingPosition: earthDock,
      landingFacade: [0, 0, 1],
      launchNormal: lunarLanding.normal,
      flightPhase,
      transportedFrame,
      elapsedMs,
      journeyDirection: "return",
      progress,
      cameraStartPosition,
      cameraStartTarget,
      cameraStartUp: lunarLanding.normal,
      stableUp: lunarLanding.normal,
      vehicleHeight: 0.08,
      arrivalVehicleHeight: 0.32,
      ignitionShare: PLANET_HUB_JOURNEY_IGNITION_MS / PLANET_HUB_JOURNEY_DURATION_MS,
      launchViewHoldShare: PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS / PLANET_HUB_JOURNEY_DURATION_MS,
      followBlendShare: 860 / PLANET_HUB_JOURNEY_DURATION_MS
    });
    return { elapsedMs, flightPhase, rocket, camera };
  });

  for (const sample of samples.slice(0, 3)) {
    assert.deepEqual(sample.camera.position, cameraStartPosition,
      "the reverse launch keeps the same readable front camera for the complete two-second hold");
    assert.ok(sample.camera.target.every(Number.isFinite));
    assert.equal(sample.camera.stage, "ground-launch");
  }
  assert.ok(samples[1].camera.target.some((value, index) => Math.abs(value - cameraStartTarget[index]) > 1e-6),
    "the grounded return camera follows the lunar liftoff with a controlled gaze pan");
  const boundaryDelta = Math.hypot(...samples[3].camera.position.map((value, index) => (
    value - samples[2].camera.position[index]
  )));
  assert.ok(boundaryDelta < 0.01, "the launch-to-chase handoff is continuous instead of a camera cut");

  for (const sample of samples.filter(({ elapsedMs }) => elapsedMs >= 7850)) {
    assert.ok(Math.hypot(...sample.camera.position) >= earthRadius + 0.08 - 1e-9,
      `the ${sample.elapsedMs}ms landing camera remains outside Earth's body`);
    assert.ok(sample.camera.position.every(Number.isFinite));
    assert.ok(sample.camera.target.every(Number.isFinite));
  }
  const touchdown = samples.at(-1);
  assert.deepEqual(touchdown.rocket.position, earthDock);
  assert.ok(touchdown.rocket.orientation.reduce((sum, value, index) => sum + value * earthNormal[index], 0) > 0.999999,
    "the return vehicle finishes upright along Earth's local surface normal");
  assert.ok(touchdown.camera.position.reduce((sum, value, index) => sum + value * earthNormal[index], 0) > 0,
    "the final landing camera stays on the visible dock hemisphere");
  assert.ok(Math.hypot(...samples.find(({ elapsedMs }) => elapsedMs === 8600).camera.position
    .map((value, index) => value - touchdown.camera.position[index])) < 1e-12,
    "the last two seconds use one locked landing camera instead of rotating during touchdown");
});

test("reduced-motion handoff never detaches or traverses the rocket", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const fallbackStart = source.indexOf("function completeReducedMotionJourneyHandoff(");
  const beginStart = source.indexOf("function beginJourneyFlight(", fallbackStart);
  const settleStart = source.indexOf("function settleJourneyDeparture(", beginStart);
  assert.ok(fallbackStart >= 0 && beginStart > fallbackStart && settleStart > beginStart);
  const fallback = source.slice(fallbackStart, beginStart);
  const begin = source.slice(beginStart, settleStart);

  assert.match(fallback, /restoreHomeCamera\(\)/,
    "the accessibility path stays on canonical Home framing");
  assert.match(fallback, /planetHubJourneyPresentation\s*=\s*"crossfade"/,
    "the renderer exposes its non-spatial result to the host presentation");
  assert.doesNotMatch(fallback, /calculatePlanetHubJourneyDeparturePose|celestialSystem[.]attach|journeyDeparture\s*=/,
    "the crossfade path cannot enter the Bezier or detached-vehicle pipeline");

  const branchAt = begin.indexOf('if (presentation.mode === "crossfade")');
  const detachAt = begin.indexOf("celestialSystem.attach?.(journeyRocket)");
  assert.ok(branchAt >= 0 && detachAt > branchAt,
    "reduced motion returns through the crossfade before any spatial setup");
  assert.doesNotMatch(begin, /motion\s*\?\s*260|motion\s*\?\s*32/,
    "the former 260ms/32ms compressed flight constants must not return");
});

test("the WebGL Home owns its backdrop instead of compositing legacy painted-space layers", async () => {
  const [css, html, renderer] = await Promise.all([
    readFile(new URL("../public/planet-hub.css", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8")
  ]);
  assert.match(html, /<section\b[^>]*\bid="startScreen"[^>]*\bdata-planet-hub-home\b/,
    "the permanent Home host exposes an explicit CSS-safe planet-hub marker");
  const hubMarker = String.raw`#startScreen[.]start-screen\[data-planet-hub-home\]`;
  assert.match(css, new RegExp(`${hubMarker}::before,?[\\s\\S]{0,220}${hubMarker}::after\\s*\\{[^}]*background:\\s*none\\s*!important`, "i"),
    "legacy pseudo-element stars and painted overlays must not remain behind WebGL");
  assert.match(css, new RegExp(`${hubMarker}[\\s\\S]{0,120}?[.]home-vfx\\s*\\{[^}]*display:\\s*none`, "i"),
    "the legacy Home VFX layer must not create a second particle field around the 3D scene");
  assert.match(css, new RegExp(`${hubMarker}\\s*\\{[^}]*background-image:\\s*none\\s*!important`, "i"),
    "the legacy illustrated cosmos must not remain visible through the transparent WebGL canvas");
  assert.match(renderer, /new THREE[.]WebGLRenderer\(\{[\s\S]{0,520}?alpha:\s*false/,
    "the full-viewport renderer needs an opaque framebuffer so additive sky passes cannot create dark alpha islands");
  assert.match(renderer, /setClearColor[?]?[.]\(0x01060f,\s*1\)/,
    "the renderer clear should match the permanent Home void rather than expose a second DOM backdrop");
});

test("space ambience keeps its closed dome and uses bounded spherical GPU detail", async () => {
  const source = await readFile(new URL("../public/planet-hub-space.mjs", import.meta.url), "utf8");
  assert.match(source, /new THREE[.]SphereGeometry\(/,
    "space ambience should remain a camera-enclosing sphere");
  assert.match(source, /createPlanetHubStarFieldData[\s\S]*new THREE[.]Points\(starGeometry, starMaterial\)/,
    "crisp stars should come from deterministic spherical data instead of a loose screen-space emitter");
  assert.match(source, /starField[.]frustumCulled\s*=\s*false/,
    "the camera-enclosing star sphere must not collapse into the historical edge wedge");
  assert.match(source, /root[.]position[.]copy\(camera[.]position\)/,
    "all sky geometry remains camera-centered during Home orbit and journey flight");
});

test("focused presentation uniformly enlarges the complete world", () => {
  assert.equal(calculatePlanetHubPresentationScale("overview"), 1);
  const focused = calculatePlanetHubPresentationScale("focused");
  assert.equal(focused, 2.2, "Journey focus should make the complete planet and launch ensemble unmistakably foregrounded");
  assert.equal(calculatePlanetHubPresentationScale("unexpected"), 1);
});

test("destination and focus moves share a deliberate zero-velocity cinematic settle", () => {
  assert.equal(calculatePlanetHubPresentationDuration({ kind: "destination", width: 1280 }), 1040);
  assert.equal(calculatePlanetHubPresentationDuration({ kind: "focus-in", width: 1280 }), 1120);
  assert.equal(calculatePlanetHubPresentationDuration({ kind: "focus-out", width: 390 }), 960);
  assert.equal(calculatePlanetHubPresentationDuration({ kind: "focus-in", reducedMotion: true }), 200);

  const samples = [0, .1, .25, .5, .75, .9, 1]
    .map((value) => easePlanetHubPresentationProgress(value, "focus-in"));
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 1);
  assert.ok(samples.every((value, index) => index === 0 || value >= samples[index - 1]));
  assert.ok(samples[1] < .01, "focus starts gently instead of spending a quarter of its distance immediately");
  assert.equal(samples[3], .5);
  assert.equal(easePlanetHubPresentationProgress(.1, "destination"), samples[1],
    "destination turns and focus moves share one physically calm transition grammar");
});

test("focused resize retargets camera motion instead of cancelling and snapping", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function resize()");
  const end = source.indexOf("function updateFlames(", start);
  const resizeBranch = source.slice(start, end);
  assert.match(resizeBranch, /transition[.]orbitTo\s*=\s*cloneCameraOrbitState\(target[.]cameraOrbit\)/);
  assert.match(resizeBranch, /kind:\s*\"focus-reframe\"/);
  assert.doesNotMatch(resizeBranch, /transition\s*=\s*null/);
  assert.doesNotMatch(resizeBranch, /world[.]position[.]copy\(target[.]position\)/);
});

test("focus transitions exclusively own the camera while the geographic world stays stable", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const hoverStart = source.indexOf("function setHoveredDestination(");
  const clearStart = source.indexOf("function clearPointerOrbit(", hoverStart);
  const clearEnd = source.indexOf("function setHubMode(", clearStart);
  const orbitClear = source.slice(clearStart, clearEnd);

  assert.match(orbitClear, /if \(transition\) return false/);

  const completionStart = source.indexOf("if (transition) {", source.indexOf("function renderFrame("));
  const completionEnd = source.indexOf("if (zoomPending", completionStart);
  const completion = source.slice(completionStart, completionEnd);
  assert.match(completion, /const interpolatedOrbit\s*=\s*interpolatePlanetHubCameraOrbitState\(/);
  assert.match(completion, /transition[.]owner === "home-orbit"[\s\S]*constrainPlanetHubCameraOrbitForView\(interpolatedOrbit/,
    "overview transitions must stay level while the fixed ecliptic chart is visible");
  assert.match(completion, /applyCameraOrbitState\(transition[.]orbitTo\)/);
  assert.doesNotMatch(completion, /world[.]quaternion[.](?:copy|slerp|premultiply)/);
  assert.doesNotMatch(completion, /celestialSystem[.](?:position|scale)[.](?:copy|lerp)/);

  const dragStart = source.indexOf("function setPointerDrag(");
  const dragEnd = source.indexOf("function releasePointerDrag(", dragStart);
  const drag = source.slice(dragStart, dragEnd);
  assert.match(drag, /applyPlanetHubVisualRotationToCameraOrbit\(cameraOrbitState,\s*\{[\s\S]*?[.][.]step[.]delta/);
  assert.doesNotMatch(drag, /world[.]quaternion[.](?:copy|premultiply|multiply|slerp)/,
    "direct manipulation must orbit the camera, not rewrite geographic coordinates");

  const renderStart = source.indexOf("function renderFrame(");
  const renderEnd = source.indexOf("function requestRender(", renderStart);
  const renderFrame = source.slice(renderStart, renderEnd);
  assert.match(renderFrame, /let interactionMotionFrame = interactiveFrame/,
    "the motion-frame reconciliation flag must be scoped to every live render frame");
  assert.equal((source.match(/let interactionMotionFrame = interactiveFrame/g) || []).length, 1,
    "the motion-frame flag must not be stranded inside an unrelated helper");
});

test("Journey rocket and landing pad inherit one oriented site transform", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function addLandmark(destination)");
  const end = source.indexOf("async function addPortalSurface()", start);
  assert.ok(start >= 0 && end > start, "the Journey landmark builder must remain inspectable");
  const builder = source.slice(start, end);
  const orientedAt = builder.indexOf("orientSite(root, destination)");
  const padAt = builder.indexOf("root.add(model)");
  const rocketAt = builder.indexOf("root.add(rocket)");
  assert.ok(orientedAt >= 0 && padAt > orientedAt && rocketAt > padAt,
    "the pad and rocket must be siblings under the same already-oriented site root");
  assert.match(builder, /new THREE[.]Vector3\([.][.][.]authoredDock\)[.]applyMatrix4\(model[.]matrix\)[\s\S]*?rocket[.]position[.]copy\(dock\)/,
    "the rocket must transform the authored dock into the landing pad's local presentation space");
  assert.match(builder, /setDestinationMetadata\(rocket, destination\)/,
    "clicks on the rocket hierarchy must resolve to the Journey destination");
  assert.match(builder, /root[.]scale[.]setScalar\(quality === "standard" \? 1[.]16 : 1[.]22\)/,
    "the complete landmark ensemble keeps its intentionally readable authored scale");
  assert.doesNotMatch(source, /baseSiteScale|root[.]scale[.]setScalar\(baseSiteScale\)/,
    "presentation transitions must not silently shrink the shared pad-and-rocket site scale");
  assert.match(source, /function setHoveredDestination\([^)]*\{ action = null \}[\s\S]*?action === "journey-launch"[\s\S]*?rocketHoverLevel = rocketHovered \? 0[.]72 : 0/,
    "focused Journey rocket hover must drive a visible idle ignition affordance");
});

test("rocket ignition bursts preserve steady sources and cannot be shortened", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function setRocketIgnition(");
  const end = source.indexOf("function pickDetail(", start);
  assert.ok(start >= 0 && end > start, "the rocket ignition setter must remain inspectable");
  const setter = source.slice(start, end);
  assert.match(setter, /ignitionUntil = Math[.]max\(ignitionUntil, now \+ duration\)/,
    "a semantic click must not shorten an already-running focus burst");
  assert.doesNotMatch(setter, /ignitionLevel = 0|ignitionUntil = 0/,
    "transient bursts and steady hover/focus ignition must remain independent sources");
  assert.match(source, /return active \|\| \(!reducedMotion && target > 0\)/,
    "static reduced-motion ignition must not schedule perpetual animation frames");
});

test("live reduced-motion changes update the renderer closure and pause requested portal media", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function setEffectsLevel(");
  const end = source.indexOf("function setRocketIgnition(", start);
  assert.ok(start >= 0 && end > start, "the live effects setter must remain inspectable");
  const setter = source.slice(start, end);
  assert.match(setter, /reducedMotion = nextReducedMotion/,
    "an OS preference change must update the closure read by orbit, Moon, hover, flame and transition paths");
  assert.match(setter, /resetOrbitIdle\(\{ active: false, suppressed: hubMode !== "overview" \|\| reducedMotion \}\)/,
    "idle rotation must stop immediately and resume only through its settled-delay policy");
  assert.match(setter, /setPortalVisible\(portalRequestedVisible\)/,
    "Arena video should pause under reduced motion without forgetting its requested destination state");
  assert.match(setter, /celestialCosmology[?][.]setEffectsLevel[?][.]\(currentEffectsLevel/,
    "outer-universe volume and splat quality follows live effects changes");
  const renderFrame = source.slice(source.indexOf("function renderFrame("), source.indexOf("function requestRender("));
  assert.match(renderFrame, /celestialCosmology[?][.]setRenderContext[?][.]\(\{[\s\S]*cameraPosition:[\s\S]*moving:/,
    "cinematic volume shaders receive live camera and motion context without owning a second renderer");
});

test("responsive camera preserves square poster framing and fits narrow viewports", () => {
  assert.equal(calculatePlanetHubCameraDistance({ baseDistance: 4.5, aspect: 1 }), 4.5);
  assert.equal(calculatePlanetHubCameraDistance({ baseDistance: 4.5, aspect: 16 / 9 }), 4.5);
  assert.equal(calculatePlanetHubCameraDistance({ baseDistance: 4.5, aspect: 0.5 }), 9);
  assert.ok(Math.abs(calculatePlanetHubCameraDistance({ baseDistance: 4.5, aspect: 320 / 568 }) - 7.9875) < 1e-9);
});

test("Journey focus framing keeps the complete launch site clear of compact action cards", () => {
  assert.deepEqual(calculatePlanetHubFocusFraming({
    destination: "journey",
    width: 320,
    height: 438
  }), {
    key: "journey-compact-portrait",
    normal: [0, 0.94, 0.341174],
    position: [0, -1.62, 0]
  });
  assert.deepEqual(calculatePlanetHubFocusFraming({
    destination: "journey",
    width: 475,
    height: 213
  }), {
    key: "journey-short-landscape",
    normal: [0, 0.9, 0.43589],
    position: [-0.5, -2.04, 0]
  });
  assert.deepEqual(calculatePlanetHubFocusFraming({
    destination: "journey",
    width: 1280,
    height: 720
  }), {
    key: "journey-wide",
    normal: [-0.02, 0.9, 0.43543],
    position: [-0.42, -2.15, 0]
  }, "the tall desktop rocket receives dedicated nose-cone headroom");
  assert.deepEqual(calculatePlanetHubFocusFraming({
    destination: "forge",
    width: 1280,
    height: 720
  }), {
    key: "forge-wide",
    normal: [-0.045, 0.91, 0.412],
    position: [-0.38, -1.9, 0]
  }, "desktop focus uses a shallow horizon view and raises the full facade into the safe frame");
  assert.deepEqual(calculatePlanetHubFocusFraming({
    destination: "forge",
    width: 320,
    height: 438
  }), {
    key: "forge-narrow",
    normal: [-0.045, 0.91, 0.412],
    position: [0, -1.62, 0]
  }, "narrow focus keeps the same readable front with phone-safe world placement");
});

test("focused presentation consumes the composed horizon position instead of optical-axis centering", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function presentationTarget(");
  const end = source.indexOf("function startPresentationTransition(", start);
  const target = source.slice(start, end);
  assert.match(target, /const position = mode === "focused"\s*\? new THREE[.]Vector3\([.][.][.]focusFraming[.]position\)/);
  assert.match(target, /const authoredOrbit = equivalentCameraOrbitForPresentation\(\{ quaternion, position, scale \}\)/,
    "the authored horizon translation must be expressed by the inverse camera pose");
  assert.match(target, /mode === "overview"[\s\S]*overviewOrbitWithViewZoom\(authoredOrbit\)[\s\S]*:\s*authoredOrbit/,
    "overview semantic zoom must preserve the authored focus orbit unchanged");
  assert.doesNotMatch(target, /calculatePlanetHubFocusTranslation/,
    "the focused structure must rise from the horizon rather than pinning its measured center to NDC 0,0");
});

test("responsive focus framing never enlarges the Journey launch ensemble on a narrow phone", () => {
  const focusScale = calculatePlanetHubPresentationScale("focused");
  const projectedScale = (aspect) => focusScale / calculatePlanetHubCameraDistance({
    baseDistance: 4.5,
    aspect,
    referenceAspect: 1
  });
  assert.equal(projectedScale(16 / 9), projectedScale(1), "wide and square views preserve the authored focus framing");
  assert.ok(projectedScale(390 / 844) < projectedScale(1),
    "portrait framing backs the camera away from the complete pad-and-rocket group instead of clipping it");
  assert.ok(projectedScale(667 / 375) <= projectedScale(1),
    "short landscape does not magnify the complete Journey ensemble beyond the authored frame");
});

test("planet material normalization keeps albedo detail but removes costly emissive output", () => {
  class MeshStandardMaterial {
    constructor(options) { Object.assign(this, options); this.emissiveMap = { stale: true }; this.userData = {}; }
  }
  const map = { isTexture: true };
  const emissiveMap = { isTexture: true };
  const color = { clone: () => ({ copied: true }) };
  const material = createPlanetHubPlanetMaterial({ MeshStandardMaterial }, {
    name: "Earth",
    color,
    map,
    emissiveMap,
    emissiveIntensity: 8,
    roughness: 0.2,
    metalness: 0.9
  });
  assert.equal(material.map, map);
  assert.equal(material.emissiveMap, null);
  assert.equal(material.emissiveIntensity, 0);
  assert.equal(material.roughness, 0.72);
  assert.equal(material.metalness, 0.08);
  assert.equal(material.toneMapped, true);
  assert.equal(material.userData.planetHubNormalized, true);
  assert.equal(material.userData.planetHubMaterialRole, "planet");
});

test("dynamic Sun materials preserve the terminator, authored surface, and reduced-motion contracts", () => {
  class ShaderMaterial {
    constructor(options) { Object.assign(this, options); }
  }
  class Vector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    normalize() {
      const length = Math.hypot(this.x, this.y, this.z) || 1;
      this.x /= length;
      this.y /= length;
      this.z /= length;
      return this;
    }
  }
  class Color {
    constructor(value) { this.value = value; }
  }
  const THREE = {
    ShaderMaterial,
    Vector3,
    Color,
    AdditiveBlending: "additive"
  };
  const texture = { isTexture: true };

  const night = createPlanetHubNightLightsMaterial(THREE, texture, { opacity: 4 });
  assert.equal(night.uniforms.nightMap.value, texture);
  assert.equal(night.uniforms.opacity.value, 1, "night opacity remains bounded for additive blending");
  assert.ok(Math.abs(Math.hypot(
    night.uniforms.sunDirection.value.x,
    night.uniforms.sunDirection.value.y,
    night.uniforms.sunDirection.value.z
  ) - 1) < 1e-12);
  assert.match(night.fragmentShader, /dot\(normalize\(vWorldNormal\),normalize\(sunDirection\)\)/,
    "city lights must derive their night mask from the same world-space Sun direction");
  assert.match(night.fragmentShader, /nightMask=1[.]-smoothstep/);
  assert.match(night.fragmentShader, /\n#include <tonemapping_fragment>\r?\n#include <colorspace_fragment>/,
    "Three shader chunks must begin on their own lines so WebGL preprocessors accept them");
  assert.equal(night.transparent, true);
  assert.equal(night.depthWrite, false);
  assert.equal(night.blending, THREE.AdditiveBlending);
  assert.equal(night.toneMapped, true);

  const surface = createPlanetHubSunSurfaceMaterial(THREE, texture, { reducedMotion: true });
  assert.equal(surface.uniforms.surfaceMap.value, texture);
  assert.equal(surface.uniforms.hasSurfaceMap.value, 1);
  assert.equal(surface.uniforms.motion.value, 0, "reduced motion freezes convection at construction");
  assert.equal(surface.uniforms.modelOpacity.value, 1);
  assert.match(surface.fragmentShader, /granule[\s\S]*convection[\s\S]*\*motion/);
  assert.match(surface.fragmentShader, /texture2D\(surfaceMap,vUv\)/,
    "the generated solar derivative must remain visible instead of being replaced by flat white");
  assert.match(surface.fragmentShader, /\n#include <tonemapping_fragment>\r?\n#include <colorspace_fragment>\n}/,
    "the bright solar surface must pass through the same filmic output transform as the world");
  assert.equal(surface.toneMapped, true);
  assert.equal(surface.transparent, true,
    "the physical surface supports the short model/particle crossfade");
  assert.equal(surface.depthWrite, true);
  const proceduralSurface = createPlanetHubSunSurfaceMaterial(THREE, null);
  assert.equal(proceduralSurface.uniforms.hasSurfaceMap.value, 0);
  assert.equal(proceduralSurface.uniforms.motion.value, 1);

});

test("one visible-Sun rig drives the key, atmosphere, night mask, and occluded flare", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const rigStart = source.indexOf("function updateSunLightingRig(");
  const rigEnd = source.indexOf("function updateSun(", rigStart);
  const rig = source.slice(rigStart, rigEnd);
  assert.ok(rigStart >= 0 && rigEnd > rigStart);
  assert.match(rig, /sunRoot[\s\S]*getWorldPosition/,
    "the rendered Sun, rather than an unrelated mood vector, must own the physical light direction");
  assert.match(rig, /calculatePlanetHubSunLightingRig\([\s\S]*sunPosition:\s*visibleSunPosition[.]toArray\(\)/);
  assert.match(rig, /keyLight[.]position[.]set\([.][.][.]lighting[.]keyPosition\)/);
  assert.match(rig, /keyLight[.]target[.]position[.]set\([.][.][.]lighting[.]targetPosition\)/);
  assert.match(rig, /atmosphereMaterial[?][.]uniforms[?][.]sunDirection[?][.]value[?][.]set[?][.]\([.][.][.]lighting[.]direction\)/);
  assert.match(rig, /surfaceNightLayer[?][.]material[?][.]uniforms[?][.]sunDirection[?][.]value[?][.]set[?][.]\([.][.][.]lighting[.]direction\)/);
  assert.match(rig, /Object[.]values\(celestialRegistry[\s\S]*calculatePlanetHubSunDiscVisibility\([\s\S]*planetRadius:[\s\S]*sunRadius(?:\s*:|\s*[,}])/,
    "every visible celestial body may physically eclipse the one world-space Sun");
  assert.match(rig, /sunEffects[?][.]update[?][.]\(\{[\s\S]*camera,[\s\S]*sunPosition:\s*visibleSunPosition[.]toArray\(\)[\s\S]*discVisibility:\s*visibility/);
  assert.match(rig, /resolvePlanetHubSunLod\(\{[\s\S]*physicalWorldRadius:\s*sunRadius,[\s\S]*cameraDistance,[\s\S]*progress:\s*viewZoom[.]progress/,
    "one physical projection must own the model/particle/glare handoff");
  assert.match(rig, /sunEffects[?][.]update[?][.]\(\{[\s\S]*physicalRadius:\s*sunRadius,[\s\S]*opacity:\s*sunLod[.]glareOpacity[\s\S]*scale:\s*sunLod[.]glareScale/,
    "the optical pass derives from the same physical Sun radius as the model");
  assert.match(rig, /sunModel[.]visible\s*=\s*modelOpacity\s*>\s*0[.]001/);
  assert.match(rig, /sunParticle[.]visible\s*=\s*particleOpacity\s*>\s*0[.]001/);
  assert.match(rig, /proxyDistance\s*=\s*Math[.]min\(cameraDistance[\s\S]*sunVisualRoot[.]scale[.]setScalar\(sunRadius\s*\*\s*proxyDistance[\s\S]*cameraDistance/,
    "the multi-scale model view preserves angular size when the physical Sun lies beyond the precision far plane");
  assert.doesNotMatch(rig, /sunAtlas/,
    "the physical Sun must never be replaced by a disconnected screen-space atlas body");
  assert.doesNotMatch(source, /decorative-sun-(?:halo|corona)/,
    "the one-pass ray rig replaces concentric transparent Sun shells");

  const updateStart = source.indexOf("function updateSun(", rigEnd);
  const updateEnd = source.indexOf("function updateFrontLandmark(", updateStart);
  const update = source.slice(updateStart, updateEnd);
  assert.ok(update.indexOf("updateSunLightingRig(now)") < update.indexOf("if (!sunModel) return false"),
    "dynamic planet lighting must survive an unavailable decorative Sun mesh");

  const frameStart = source.indexOf("function renderFrame(");
  const frameEnd = source.indexOf("function requestRender(", frameStart);
  const frame = source.slice(frameStart, frameEnd);
  const cameraMatrixAt = frame.indexOf("camera.updateMatrixWorld?.(true)");
  const sunAt = frame.indexOf("updateSun(now)");
  assert.ok(cameraMatrixAt >= 0 && cameraMatrixAt < sunAt,
    "the Sun projection must see the current frame camera matrix, never the previous orbit frame");

  const effectsStart = source.indexOf("function setEffectsLevel(");
  const effectsEnd = source.indexOf("function setRocketIgnition(", effectsStart);
  const effects = source.slice(effectsStart, effectsEnd);
  assert.match(effects, /sunSurfaceMaterial[?][.]uniforms[?][.]motion[\s\S]*reducedMotion\s*\?\s*0\s*:\s*1/);
  assert.match(effects, /sunEffects[?][.]setEffects[?][.]\(\{\s*effectsLevel:\s*currentEffectsLevel,\s*reducedMotion\s*\}\)/,
    "live effects changes must update the procedural solar rig");
});

test("renderer streams manifest-resolved Earth detail maps and the Sun emissive surface", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const surfaceStart = source.indexOf("const surfaceHooks = resolvePlanetHubSurfaceHooks(");
  const surfaceEnd = source.indexOf("if (worldId === \"earth\" && manifest.worlds", surfaceStart);
  const surfaceSetup = source.slice(surfaceStart, surfaceEnd);
  assert.ok(surfaceStart >= 0 && surfaceEnd > surfaceStart);
  for (const hook of ["roughness", "normal", "clouds", "night", "sunEmissive"]) {
    assert.match(surfaceSetup, new RegExp(`surfaceHooks[.]${hook}`), `${hook} must be requested through the manifest resolver`);
  }
  assert.match(surfaceSetup, /surfaceSunEmissiveMap\s*=\s*texture/,
    "the resolved Sun derivative must survive until the authored Sun is constructed");
  assert.doesNotMatch(surfaceSetup, /await\s+Promise[.]all\(/,
    "optional surface texture transfer and decode must never block the core renderer");
  assert.match(surfaceSetup, /void\s+Promise[.]all\(progressiveSurfaceHooks[.]map/,
    "surface hooks must begin progressively without joining the renderer readiness promise");
  assert.match(surfaceSetup, /disposed\s*\|\|\s*generation\s*!==\s*surfaceHookLoadGeneration[\s\S]*texture[?][.]dispose[?][.]\(\)/,
    "late texture decodes must be discarded after teardown or renderer replacement");
  assert.match(surfaceSetup, /attachSurfaceHook[\s\S]*requestRenderAcrossConstruction\(\)/,
    "each successfully attached progressive layer must invalidate the ready scene");

  const sunStart = source.indexOf("const sunAsset = manifest.shared");
  const sunEnd = source.indexOf("for (const road of createGreatCircleRoads", sunStart);
  const sunSetup = source.slice(sunStart, sunEnd);
  assert.match(sunSetup, /surfaceSunEmissiveMap\s*\|\|\s*sunMaterial[?][.]emissiveMap\s*\|\|\s*sunMaterial[?][.]map/,
    "the generated emissive derivative must win while authored model maps remain a safe fallback");
  assert.match(sunSetup, /planetHubSunSurface\s*=\s*surfaceSunEmissiveMap[\s\S]*manifest-emissive[\s\S]*model-map/,
    "runtime diagnostics must reveal whether the generated Sun surface was actually selected");
});

test("optional surface hooks retain the base glTF UV coordinate contract before use", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../public/art/planet-hub/manifest.json", import.meta.url),
    "utf8"
  ));
  const contract = manifest.optionalDetails?.textureContract;
  assert.deepEqual(contract, {
    flipY: false,
    uvChannel: 0,
    authoredColorSpace: "srgb",
    supportColorSpace: "none"
  }, "the optional Earth maps must declare the same orientation and UV set as glTF textures");

  const earthGlb = await readFile(new URL(
    "../public/art/planet-hub/models/earth-low.glb",
    import.meta.url
  ));
  assert.equal(earthGlb.toString("ascii", 0, 4), "glTF");
  const jsonChunkLength = earthGlb.readUInt32LE(12);
  const earthJson = JSON.parse(
    earthGlb.subarray(20, 20 + jsonChunkLength).toString("utf8").replace(/[\u0000\s]+$/, "")
  );
  const earthMaterial = earthJson.materials.find((material) => material.name === "phong1");
  const baseColor = earthMaterial?.pbrMetallicRoughness?.baseColorTexture;
  const baseTexture = earthJson.textures[baseColor?.index];
  const baseSampler = earthJson.samplers[baseTexture?.sampler];
  assert.equal(baseColor?.texCoord ?? 0, contract.uvChannel,
    "the generated Earth albedo and optional hooks must address the same UV set");
  assert.equal(baseColor?.extensions?.KHR_texture_transform, undefined,
    "the base Earth cannot carry a hidden transform that optional hooks fail to reproduce");
  assert.equal(baseSampler?.wrapS, 10497,
    "the generated glTF Earth repeats horizontally across its equirectangular seam");

  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const setupStart = source.indexOf("const surfaceHooks = resolvePlanetHubSurfaceHooks(");
  const loaderStart = source.indexOf("async function loadSurfaceHook(", setupStart);
  const loaderEnd = source.indexOf("\n  }", loaderStart);
  assert.ok(setupStart >= 0 && loaderStart > setupStart && loaderEnd > loaderStart);
  const setup = source.slice(setupStart, loaderStart);
  const loader = source.slice(loaderStart, loaderEnd);
  assert.match(setup, /manifest[?]?[.]optionalDetails[?]?[.]textureContract/,
    "runtime must consume the versioned manifest texture contract rather than duplicate it implicitly");
  const configureAt = loader.indexOf("configurePlanetHubSurfaceTexture(");
  const ownershipAt = loader.indexOf("surfaceHookTextures.push(texture)");
  const returnAt = loader.indexOf("return texture");
  assert.ok(configureAt >= 0 && configureAt < ownershipAt && configureAt < returnAt,
    "the manifest UV contract must be applied before renderer ownership or material use");

  const THREE = { RepeatWrapping: 1000, SRGBColorSpace: "srgb" };
  const texture = {
    flipY: true,
    channel: 3,
    wrapS: "clamp-s",
    wrapT: "clamp-t",
    colorSpace: "none"
  };
  assert.equal(configurePlanetHubSurfaceTexture(THREE, texture, contract, { color: true }), texture,
    "configuration must preserve the loaded texture identity");
  assert.deepEqual(texture, {
    flipY: false,
    channel: 0,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    colorSpace: THREE.SRGBColorSpace
  }, "authored Earth hooks must exactly match glTF orientation, UV0, wrapping, and color space");

  const missingValues = {
    flipY: true,
    channel: 2,
    wrapS: "clamp-s",
    wrapT: "clamp-t",
    colorSpace: "linear"
  };
  configurePlanetHubSurfaceTexture(THREE, missingValues, {}, { color: false });
  assert.equal(missingValues.flipY, true, "a missing flipY contract cannot silently change orientation");
  assert.equal(missingValues.channel, 2, "a missing UV contract cannot silently change channels");
  assert.equal(missingValues.colorSpace, "linear", "non-color support maps retain their linear color space");
  assert.equal(missingValues.wrapS, THREE.RepeatWrapping);
  assert.equal(missingValues.wrapT, THREE.RepeatWrapping);

  const unsupportedValues = {
    flipY: true,
    channel: 1,
    wrapS: "original-s",
    wrapT: "original-t",
    colorSpace: "original-color"
  };
  configurePlanetHubSurfaceTexture({}, unsupportedValues, { flipY: "false", uvChannel: -1 }, { color: false });
  assert.deepEqual(unsupportedValues, {
    flipY: true,
    channel: 1,
    wrapS: "original-s",
    wrapT: "original-t",
    colorSpace: "original-color"
  }, "unsupported contract values and absent Three constants leave coordinate state unchanged");
  assert.equal(configurePlanetHubSurfaceTexture(THREE, null, contract, { color: true }), null);
});

test("hero materials retain useful authored PBR differences without requiring environment maps", () => {
  class MeshStandardMaterial {
    constructor(options) { Object.assign(this, options); this.userData = {}; }
  }
  const source = {
    roughness: 0.12,
    metalness: 0.92,
    emissive: 0x64dfff,
    emissiveIntensity: 4,
    emissiveMap: { isTexture: true }
  };
  const landmark = createPlanetHubPlanetMaterial({ MeshStandardMaterial }, source, { role: "landmark" });
  const vehicle = createPlanetHubPlanetMaterial({ MeshStandardMaterial }, source, { role: "vehicle" });
  assert.equal(landmark.roughness, 0.42);
  assert.equal(landmark.metalness, 0.35);
  assert.equal(landmark.emissiveIntensity, 0.08);
  assert.equal(landmark.userData.planetHubMaterialRole, "landmark");
  assert.equal(vehicle.roughness, 0.3);
  assert.equal(vehicle.metalness, 0.5);
  assert.equal(vehicle.emissiveIntensity, 0.06);
  assert.equal(vehicle.userData.planetHubMaterialRole, "vehicle");
});

test("Three.js and GLTFLoader stay behind the documented lazy local-vendor contract", async () => {
  class WebGLRenderer {}
  class GLTFLoader {}
  const imports = [];
  const modules = await loadPlanetHubThree({
    importer: async (specifier) => {
      imports.push(specifier);
      return { WebGLRenderer, GLTFLoader };
    }
  });
  assert.deepEqual(imports, [DEFAULT_PLANET_HUB_THREE_SPECIFIER],
    "The generated vendor graph must instantiate Three and GLTFLoader through one URL.");
  assert.equal(modules.THREE.WebGLRenderer, WebGLRenderer);
  assert.equal(modules.GLTFLoader, GLTFLoader);

  const fallbackImports = [];
  const fallbackModules = await loadPlanetHubThree({
    importer: async (specifier) => {
      fallbackImports.push(specifier);
      if (specifier === DEFAULT_PLANET_HUB_THREE_SPECIFIER) return { WebGLRenderer };
      return { GLTFLoader };
    }
  });
  assert.deepEqual(fallbackImports, [DEFAULT_PLANET_HUB_THREE_SPECIFIER, DEFAULT_PLANET_HUB_GLTF_LOADER_URL]);
  assert.equal(fallbackModules.GLTFLoader, GLTFLoader);
});

test("packed portal shader samples color and matte from synchronized texture halves", () => {
  assert.match(PACKED_PORTAL_FRAGMENT_SHADER, /vUv[.]x \* 0[.]5/);
  assert.match(PACKED_PORTAL_FRAGMENT_SHADER, /0[.]5 \+ vUv[.]x \* 0[.]5/);
  assert.match(PACKED_PORTAL_FRAGMENT_SHADER, /texture2D\(packedMap, matteUv\)[.]r/);
  assert.match(PACKED_PORTAL_FRAGMENT_SHADER, /colorSample[.]rgb \* alpha/);

  class ShaderMaterial {
    constructor(options) { Object.assign(this, options); }
  }
  const texture = { isTexture: true };
  const material = createPackedPortalMaterial({ ShaderMaterial, DoubleSide: 2, NormalBlending: 1 }, texture, { opacity: 0.75 });
  assert.equal(material.uniforms.packedMap.value, texture);
  assert.equal(material.uniforms.opacity.value, 0.75);
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);
});

test("engine plume uses a feathered axial shader without adding render passes", () => {
  class Color {
    constructor(value) { this.value = value; }
  }
  class ShaderMaterial {
    constructor(options) { Object.assign(this, options); this.userData = {}; }
  }
  const THREE = {
    ShaderMaterial,
    Color,
    AdditiveBlending: 2
  };
  const low = createPlanetHubEnginePlumeMaterial(THREE, { quality: "low", phase: 0.4 });
  const standard = createPlanetHubEnginePlumeMaterial(THREE, { quality: "standard", core: true });

  assert.equal(low.vertexShader, PLANET_HUB_ENGINE_PLUME_VERTEX_SHADER);
  assert.equal(low.fragmentShader, PLANET_HUB_ENGINE_PLUME_FRAGMENT_SHADER);
  assert.equal(low.depthWrite, false);
  assert.equal(low.toneMapped, false);
  assert.equal(low.userData.planetHubEnginePlume, true);
  assert.ok(standard.uniforms.plumeFlicker.value > low.uniforms.plumeFlicker.value,
    "standard quality may spend a slightly stronger shader flicker without another draw call");
  assert.match(PLANET_HUB_ENGINE_PLUME_FRAGMENT_SHADER, /tailFade\s*=\s*smoothstep/);
  assert.match(PLANET_HUB_ENGINE_PLUME_FRAGMENT_SHADER, /edgeFeather/);
  assert.match(PLANET_HUB_ENGINE_PLUME_FRAGMENT_SHADER, /#include <colorspace_fragment>/);
  assert.doesNotMatch(PLANET_HUB_ENGINE_PLUME_FRAGMENT_SHADER, /sampler2D|discard/,
    "the plume stays texture-free and softly fades instead of producing a clipped mask edge");
});

test("engine plume animation freezes deterministically for reduced motion", () => {
  class Color {
    constructor(value) { this.value = value; }
  }
  class ShaderMaterial {
    constructor(options) { Object.assign(this, options); this.userData = {}; }
  }
  const material = createPlanetHubEnginePlumeMaterial({
    ShaderMaterial,
    Color,
    AdditiveBlending: 2
  }, { phase: 0.35 });

  assert.equal(updatePlanetHubEnginePlumeMaterial(material, {
    opacity: 0.62,
    timeMs: 1500
  }), true);
  assert.equal(material.uniforms.plumeOpacity.value, 0.62);
  assert.equal(material.uniforms.plumeTime.value, 1.85);
  assert.equal(updatePlanetHubEnginePlumeMaterial(material, {
    opacity: 4,
    timeMs: 9000,
    reducedMotion: true
  }), true);
  assert.equal(material.uniforms.plumeOpacity.value, 1, "opacity remains bounded for additive blending");
  assert.equal(material.uniforms.plumeTime.value, 0.35, "reduced motion preserves a static authored phase");
  assert.equal(updatePlanetHubEnginePlumeMaterial({}, { opacity: 1 }), false);
});

test("portal media is transformed into the landmark aperture instead of floating in site space", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function addPortalSurface()");
  const end = source.indexOf("await addPortalSurface()", start);
  assert.ok(start >= 0 && end > start, "the portal surface builder must remain inspectable");
  const builder = source.slice(start, end);

  const planeSize = builder.match(/new THREE[.]PlaneGeometry\(([0-9.]+),\s*([0-9.]+)\)/);
  assert.ok(planeSize, "the portal media plane must expose an inspectable aperture size");
  assert.ok(Number(planeSize[1]) >= 0.38 && Number(planeSize[1]) <= 0.5,
    `portal media should fill the authored ring without covering it, received ${planeSize[1]}`);
  assert.equal(Number(planeSize[1]), Number(planeSize[2]), "the packed portal source remains square in the aperture");

  assert.match(builder, /new THREE[.]Vector3\([.][.][.]socket[.]slice\(0,\s*3\)\)[\s\S]{0,180}[.]applyMatrix4\(/,
    "manifest aperture coordinates must pass through the landmark model transform");
  assert.match(builder, /surface[.]position[.]copy\(/,
    "the transformed aperture point, rather than the raw site-space socket, must seat the VFX plane");
  assert.doesNotMatch(builder, /surface[.]position[.]set\([.][.][.]socket[.]slice\(0,\s*3\)\)/,
    "raw unscaled socket coordinates place the VFX above the visible portal opening");
  const directOffset = builder.match(/surface[.]position[.]z\s*[+]\=\s*([0-9.]+)/);
  const vectorOffset = builder.match(/const\s+apertureForward\s*=\s*new THREE[.]Vector3\(0,\s*0,\s*([0-9.]+)\)[\s\S]{0,180}surface[.]position[.]add\(apertureForward\)/);
  const forwardOffset = Number(directOffset?.[1] || vectorOffset?.[1]);
  assert.ok(forwardOffset > 0 && forwardOffset <= 0.03,
    "a tiny local +Z offset prevents z-fighting while keeping the VFX visibly seated in the ring");
  assert.match(builder, /arena[.]add\(surface\)/,
    "the VFX stays inside the complete oriented Arena landmark group");
});

test("invalid vendor modules fail before attempting to construct a scene", async () => {
  await assert.rejects(
    loadPlanetHubThree({ importer: async () => ({}) }),
    /did not expose WebGLRenderer and GLTFLoader/
  );
});

test("Moon focus remains available through celestial-body picking in far semantic bands", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function setCelestialBodyFocus(");
  const end = source.indexOf("function clearCelestialBodyFocus(", start);
  assert.ok(start >= 0 && end > start, "the generic body focus gate must remain inspectable");
  const focusGate = source.slice(start, end);

  assert.match(focusGate, /getViewInteractionRules\(\)[.]celestialBodyPicking/,
    "Moon and generated bodies use the body-picking rule enabled in system and universe views");
  assert.doesNotMatch(source, /function setSatelliteFocus\(/,
    "Moon focus must not retain a second navigation state machine");
});

test("returning from celestial focus restores the saved semantic zoom with its camera", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const focusStart = source.indexOf("function setCelestialBodyFocus(");
  const clearStart = source.indexOf("function clearCelestialBodyFocus(", focusStart);
  const clearEnd = source.indexOf("function setOrbitBody(", clearStart);
  assert.ok(focusStart >= 0 && clearStart > focusStart && clearEnd > clearStart);
  const focus = source.slice(focusStart, clearStart);
  const clear = source.slice(clearStart, clearEnd);
  assert.match(focus, /bodySavedViewZoom\s*=\s*\{[\s\S]*progress:\s*viewZoom[.]progress[\s\S]*targetProgress:\s*viewZoom[.]targetProgress/);
  assert.match(clear, /viewZoom[.]progress\s*=\s*returnProgress[\s\S]*viewZoom[.]targetProgress\s*=\s*returnTargetProgress/);
  assert.match(clear, /publishViewZoom\(\{\s*force:\s*true\s*\}\)/,
    "the restored camera and published semantic band must remain one state");
  assert.match(clear, /returnGridAnchor\s*=\s*semanticCameraTarget\(returnProgress\)/,
    "the returning ruler/grid must restore the same semantic pivot as the camera");
  assert.match(clear, /gridAnchor:\s*returnGridAnchor/,
    "the invisible focus handoff must retarget the grid to the restored pivot");
  assert.doesNotMatch(clear, /gridAnchor:\s*\[0,\s*0,\s*0\]/,
    "far-view focus return cannot silently rebase the chart to the Earth origin");
});

test("renderer resolves landmark and road anchors from the active world", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  assert.match(source, /createDestinationAnchors\(\{\s*worldId\s*\}\)/,
    "Earth geography must not leak into the Moon landmark layout");
  assert.match(source, /createGreatCircleRoads\(\{[\s\S]*?worldId,[\s\S]*?anchors,[\s\S]*?pointsPerSegment:/,
    "roads must consume the same world-specific anchors as their landmarks");
});

test("authored space layers remain progressive and document-relative", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const constructorStart = source.indexOf("spaceEnvironment = spaceEnvironmentModule.createPlanetHubSpaceEnvironment");
  const constructorEnd = source.indexOf("scene.add(spaceEnvironment.root)", constructorStart);
  const constructor = source.slice(constructorStart, constructorEnd);
  assert.match(constructor, /spaceLayers:\s*manifest[.]spaceLayers[?][.]tiers[?][.]\[quality\][?][.]layers\s*\|\|\s*\[\]/,
    "the renderer must select only the active quality tier");
  assert.match(constructor, /assetBaseUrl/,
    "authored panoramas must resolve against the document base used by every other hub asset");
  const frameStart = source.indexOf("function renderFrame(");
  const frameEnd = source.indexOf("function requestRender()", frameStart);
  const frame = source.slice(frameStart, frameEnd);
  assert.match(frame, /renderer[.]render\(scene, camera\)[\s\S]*coreSceneReady[\s\S]*spaceEnvironment[?][.]loadLayers/,
    "panorama requests must begin only after the usable core scene has rendered");
});

test("optional atlas and Sun optics preserve the release query for warm offline caching", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const loaderStart = source.indexOf("const loadOptionalModule =");
  const rendererStart = source.indexOf("const renderer =", loaderStart);
  assert.ok(loaderStart >= 0 && rendererStart > loaderStart);
  const loader = source.slice(loaderStart, rendererStart);
  assert.match(loader, /const base\s*=\s*new URL\(import[.]meta[.]url\)/);
  assert.match(loader, /url[.]search\s*=\s*base[.]search/);
  assert.match(loader, /import\(url[.]href\)[.]catch\(\(\)\s*=>\s*null\)/);
  assert.match(loader, /loadOptionalModule\(\["celestial",\s*"atlas",\s*"runtime"\]\)/);
  assert.match(loader, /loadOptionalModule\(\["planet",\s*"hub",\s*"sun",\s*"effects"\]\)/);
  assert.match(loader, /loadOptionalModule\(\["celestial",\s*"cosmology",\s*"runtime"\]\)/);
  assert.match(source, /requestIdleCallback\(warmCosmology,\s*\{\s*timeout:\s*4000\s*\}\)/,
    "outer-space geometry prewarms while Home is idle instead of blocking the first cosmic wheel pulse");
});

test("fresh-load mood callbacks and orbit labels share initialized visible-world state", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const materialState = source.indexOf("let planetSurfaceMaterial = null");
  const planetLoad = source.indexOf("const planetAsset =", materialState);
  assert.ok(materialState >= 0 && materialState < planetLoad,
    "Earth albedo state must exist before an async GLB load can yield to mood callbacks");
  assert.match(source, /planetSurfaceMaterial[.]emissiveIntensity\s*=\s*0/,
    "Earth must reflect solar lighting instead of emitting its own terrain on the night side");
  assert.doesNotMatch(source, /const earthAlbedoFloor/,
    "a planet-only ambient floor cannot flatten the terminator into an illustrated disk");
  const labelsStart = source.indexOf("function updateCelestialBodyLabels(");
  const labelsEnd = source.indexOf("function updateMoonOrbit", labelsStart);
  const labels = source.slice(labelsStart, labelsEnd);
  assert.match(labels, /if\s*\(!isCelestialBodyVisibleInBand\(body[.]id\)\)\s*continue/);
  assert.match(labels, /registry:\s*labelRegistry/,
    "Orbit label projection must receive the same local-neighborhood registry as the visible meshes");
});

test("physical chart proxies take over authored close bodies while Orbit culls remote paths", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const visibilityStart = source.indexOf("function isCelestialBodyVisibleInBand(");
  const presentationStart = source.indexOf("function syncCelestialAtlasPresentation(");
  const presentationEnd = source.indexOf("function publishViewZoom(", presentationStart);
  assert.ok(visibilityStart >= 0 && presentationStart > visibilityStart && presentationEnd > presentationStart,
    "celestial presentation must remain independently auditable");
  const visibility = source.slice(visibilityStart, presentationStart);
  const presentation = source.slice(presentationStart, presentationEnd);

  assert.match(visibility, /if\s*\(id\s*===\s*["']sun["']\)\s*return true/,
    "the physical Sun cannot disappear during the Planet-to-Orbit handoff");
  assert.match(presentation,
    /if\s*\(sunRoot\s*&&\s*!journeyDeparture\)[\s\S]*sunRoot[.]visible\s*=\s*isCelestialBodyVisibleInBand\(["']sun["'],\s*band\)[\s\S]*solarDetailOpacity/,
    "ordinary zoom keeps the authored Sun visible until the Galaxy crossfade, while Journey retains visibility authority");
  assert.match(presentation,
    /orbit[.]visible\s*=\s*orbit[.]material[.]opacity\s*>\s*0[.]004\s*&&\s*\(band\s*!==\s*["']orbit["']\s*\|\|\s*localOrbit\)/,
    "Orbit retains only the focused body neighborhood's paths");
  assert.match(presentation,
    /const\s+physicalChartBlend\s*=\s*physicalSolarChartBlend\(progress\)[\s\S]*const\s+authoredLocalVisible\s*=\s*solarDetailOpacity\s*>\s*0[.]001\s*&&\s*physicalChartBlend\s*<\s*1\s*-\s*1e-6[\s\S]*world[.]visible\s*=\s*authoredLocalVisible[\s\S]*satelliteRoot[.]visible\s*=\s*authoredLocalVisible/,
    "the landmark-bearing close Earth and Moon retire together only after a progressive chart handoff");
  assert.match(presentation,
    /const\s+authoredProxy\s*=\s*record[.]anchor[.]userData[.]planetHubAuthoredProxy[\s\S]*physicalChartBlend\s*>\s*0[.]001[\s\S]*setBodyPresentationOpacity[?][.]\([\s\S]*solarDetailOpacity\s*\*\s*physicalChartBlend/,
    "physical Earth and Moon proxies resolve gradually without reviving a duplicate atlas Sun");
  assert.match(presentation, /setSemanticTier[?][.]\(\{[\s\S]*band,[\s\S]*progress,[\s\S]*distanceMeters:[\s\S]*metersPerUnit:/,
    "the atlas receives one semantic presentation contract for solar-to-galaxy fading");
  assert.match(presentation, /celestialAtlas[.]setSemanticTier[?][.]\(/,
    "the lazy atlas owns the Galaxy grid and its galactic-center anchor");
});

test("close-body handoff shares one world transform and focus fit across every rebase", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const display = source.slice(source.indexOf("function syncCelestialChartBodyDisplayScales("),
    source.indexOf("function getBodyLabel("));
  const satellite = source.slice(source.indexOf("function satelliteOverviewScale("),
    source.indexOf("const planetAsset ="));
  const update = source.slice(source.indexOf("function updateSatellite("),
    source.indexOf("function updateSunLightingRig("));
  const focus = source.slice(source.indexOf("function resolveBodyFocusFraming("),
    source.indexOf("function navigationDistanceTargets("));
  const opacity = source.slice(source.indexOf("function restoreAuthoredHandoffPresentation("),
    source.indexOf("function syncSunPresentation("));

  assert.match(display,
    /handoff[.]radius\s*\/\s*authoredRadius[\s\S]*visual[.]scale[.]setScalar\(handoff[.]radius\s*\/\s*proxyRadius\)/,
    "authored and proxy spheres render at the same interpolated world radius");
  assert.match(display,
    /satelliteRoot[.]getWorldPosition\(authoredHandoffPosition\)[\s\S]*visual[.]position[.]copy\(moonRecord[.]anchor[.]worldToLocal\(authoredHandoffPosition\)\)/,
    "the second Moon visual is placed at the authored Moon's exact world center");
  assert.match(update,
    /moonAnchor[.]getWorldPosition\(authoredHandoffPosition\)[\s\S]*authoredCloseSystem[.]worldToLocal\(authoredHandoffPosition\)[\s\S]*satelliteLocalPosition[.]lerp\(authoredHandoffPosition,\s*physicalChartBlend\)/,
    "the shared Moon center converges continuously on the physical orbit anchor");
  assert.match(satellite,
    /world[.]getWorldPosition\(chartBodyWorldPosition\)[\s\S]*applyMatrix4\(authoredCloseSystem[.]matrixWorld\)[\s\S]*satelliteCameraDistance:\s*camera[.]position[.]distanceTo\(authoredHandoffPosition\)[\s\S]*\/\s*parentScale/,
    "Moon perspective compensation is evaluated in world space then converted back to local scale");
  assert.match(focus,
    /getCelestialBodyWorldRadius\(record\)[\s\S]*focusFit[?][.]\(record[.]id[\s\S]*activeNavigationFocusRadius\(\)[\s\S]*resolveBodyFocusFraming\(\)/,
    "focused navigation recomputes its world radius and camera fit instead of reading a stale cache");
  assert.match(opacity,
    /setAuthoredObjectOpacity\(world,\s*solarOpacity\s*\*\s*handoff[.]authoredOpacity\)[\s\S]*setBodyPresentationOpacity[?][.]\(id,\s*solarOpacity\s*\*\s*handoff[.]proxyOpacity\)/,
    "the two representations use exact complementary alpha");
  assert.match(source,
    /targetSubject:\s*activeNavigationFocusId\(\)\s*\|\|\s*orbitBodyId\s*\|\|\s*worldId/,
    "diagnostics name the actual semantic camera subject");
});

test("System solid bodies preserve physical projected diameter ratios without pixel targets", () => {
  const fov = 42;
  const height = 720;
  const distance = 16.7;
  const displayedDiameter = (bodyId, radius) => {
    const scale = calculatePlanetHubChartBodyDisplayScale({
      bodyId,
      physicalWorldRadius: radius,
      cameraDistance: distance,
      verticalFovDegrees: fov,
      viewportWidth: 1280,
      viewportHeight: height,
      progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system,
      solarDetailOpacity: 1
    });
    assert.equal(scale, 1, `${bodyId} cannot receive a solid-model readability multiplier`);
    return calculatePlanetHubProjectedBodyDiameterPixels({
      physicalWorldRadius: radius * scale,
      cameraDistance: distance,
      verticalFovDegrees: fov,
      viewportHeight: height
    });
  };
  const diameters = {
    sun: displayedDiameter("sun", 0.00865),
    jupiter: displayedDiameter("jupiter", 0.000868),
    saturn: displayedDiameter("saturn", 0.000723),
    earth: displayedDiameter("earth", 0.0000792),
    mercury: displayedDiameter("mercury", 0.0000303)
  };

  assert.ok(diameters.sun > diameters.jupiter);
  assert.ok(diameters.jupiter > diameters.saturn);
  assert.ok(diameters.saturn > diameters.earth);
  assert.ok(diameters.earth > diameters.mercury);
  assert.ok(Math.abs(diameters.sun / diameters.earth - 0.00865 / 0.0000792) < 0.001,
    "projection retains the physical Sun/Earth radius hierarchy");
});

test("solid chart-body scale is invariant to progress, focus, detail opacity, and motion settings", () => {
  const chartEntry = (PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit
    + PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system) * 0.5;
  const input = {
    bodyId: "earth",
    physicalWorldRadius: 0.0000792,
    cameraDistance: 16.7,
    verticalFovDegrees: 42,
    viewportWidth: 1280,
    viewportHeight: 720,
    solarDetailOpacity: 1
  };
  const entry = calculatePlanetHubChartBodyDisplayScale({ ...input, progress: chartEntry });
  const midpoint = calculatePlanetHubChartBodyDisplayScale({
    ...input,
    progress: (chartEntry + PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system) * 0.5
  });
  const system = calculatePlanetHubChartBodyDisplayScale({
    ...input,
    progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system
  });
  const retiring = calculatePlanetHubChartBodyDisplayScale({
    ...input,
    progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system,
    solarDetailOpacity: 0.5
  });
  const retired = calculatePlanetHubChartBodyDisplayScale({
    ...input,
    progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system,
    solarDetailOpacity: 0
  });
  const reduced = calculatePlanetHubChartBodyDisplayScale({
    ...input,
    progress: chartEntry + 0.001,
    reducedMotion: true
  });

  assert.equal(entry, 1);
  assert.equal(midpoint, 1);
  assert.equal(system, 1);
  assert.equal(retiring, 1);
  assert.equal(retired, 1);
  assert.equal(reduced, 1);
  assert.equal(calculatePlanetHubChartBodyDisplayScale({
    ...input,
    progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system,
    lockedScale: 23.5
  }), 1, "focus moves the camera rather than enlarging the solid body");
  assert.equal(calculatePlanetHubChartBodyDisplayScale({
    ...input,
    progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system,
    solarDetailOpacity: 0,
    lockedScale: 23.5
  }), 1, "even a focused display proxy retires with the solar LOD");
});

test("runtime keeps solid visuals physical and moves readability to labels, selection, and an invisible pick proxy", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function syncCelestialChartBodyDisplayScales(");
  const end = source.indexOf("function getBodyLabel(", start);
  assert.ok(start >= 0 && end > start);
  const displayPass = source.slice(start, end);
  assert.match(displayPass, /record[.]visual[?][.]scale[?][.]setScalar[?][.]\(1\)/);
  assert.match(displayPass, /sunRoot[.]scale[.]setScalar\(sunPresentation[.]radius\)/);
  assert.match(displayPass, /record[.]anchor[.]userData[.]planetHubChartDisplayScale\s*=\s*1/);
  assert.doesNotMatch(displayPass, /calculatePlanetHubChartBodyDisplayScale\(/,
    "the frame loop cannot reintroduce a pixel-sized solid model");
  assert.doesNotMatch(displayPass, /record[.]anchor[.]scale[.]set/,
    "readability must never move or scale a physical orbit anchor");
  assert.match(source, /planet-hub-sun-pick-proxy[\s\S]*planetHubInvisiblePickProxy/,
    "an invisible physical proxy preserves Sun focus after its model hands off");
  assert.match(source,
    /labelRegistry\[body[.]id\]\s*=\s*\{[\s\S]*radius:\s*record\s*\?\s*getCelestialBodyWorldRadius\(record\)/,
    "label lift and occlusion use the same displayed silhouette as picking");
});

test("the physical solar chart and semantic camera share rebased world coordinates", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const atlasStart = source.indexOf("const orbitalScale = celestialAtlasModule.CELESTIAL_ATLAS_UNIT_SCALES");
  const atlasEnd = source.indexOf("for (const road of createGreatCircleRoads", atlasStart);
  const semanticStart = source.indexOf("function semanticCameraTarget(");
  const semanticEnd = source.indexOf("function overviewOrbitWithViewZoom(", semanticStart);
  assert.ok(atlasStart >= 0 && atlasEnd > atlasStart && semanticStart >= 0 && semanticEnd > semanticStart);
  const atlasSetup = source.slice(atlasStart, atlasEnd);
  const semantic = source.slice(semanticStart, semanticEnd);

  assert.match(atlasSetup,
    /const\s+orbitalScale\s*=\s*celestialAtlasModule[.]CELESTIAL_ATLAS_UNIT_SCALES[?][.]solarUnitScale\s*\|\|\s*PLANET_HUB_DISTANCE_METERS[.]au\s*\/\s*PLANET_HUB_DISTANCE_STOPS[.]planet/,
    "the atlas derives one physical AU-to-planet scale from its published unit policy");
  assert.match(atlasSetup,
    /createCelestialAtlas\(THREE,\s*\{[\s\S]*?\borbitalScale\s*,/,
    "every origin body receives that same physical orbital scale");
  assert.doesNotMatch(atlasSetup,
    /orbitalScale\s*:\s*worldId\s*===\s*["']moon["']/,
    "Moon origin cannot substitute a visually compressed coordinate system");
  assert.match(atlasSetup, /const atlasSun\s*=\s*celestialAtlas[.]layout[.]positions[.]sun/);
  assert.match(atlasSetup,
    /setWorldGridAnchor[?][.]\(\{[\s\S]*?scope:\s*["']system["'][\s\S]*?position:\s*atlasSun/,
    "the system grid is physically anchored to the atlas Sun");
  assert.match(semantic,
    /immutableSunPosition\s*=\s*vector\(["']sun["'],\s*earthPosition\)/,
    "camera navigation resolves the rebased sunRoot world position instead of consuming atlas-local coordinates");
  assert.match(semantic,
    /galacticLocal[\s\S]*celestialSystem[.]localToWorld\(new\s+THREE[.]Vector3\([.][.][.]galacticLocal\)\)[.]toArray\(\)[\s\S]*sunPosition:\s*immutableSunPosition[\s\S]*galacticCenterPosition/,
    "both solar and galactic pivots cross the same local-to-world rebase boundary before camera use");
});

test("Galaxy retires solar labels and body picking with the solar-detail crossfade", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  assert.match(source,
    /function isSolarAtlasDetailInteractive\(\)[\s\S]*solarDetailOpacity[\s\S]*>\s*0[.]015/);
  const labels = source.slice(
    source.indexOf("function updateCelestialBodyLabels("),
    source.indexOf("function updateMoonOrbit", source.indexOf("function updateCelestialBodyLabels("))
  );
  assert.match(labels, /!isSolarAtlasDetailInteractive\(\)/,
    "projected names and FUTURE pills retire before the Galaxy becomes authoritative");
  assert.match(labels,
    /isCosmicZoomActive\(\)[\s\S]*solarMarkerLabel[.]visible\s*=\s*false[\s\S]*else\s+celestialAtlas[?][.]updateSelectionFacingCamera/,
    "camera-facing label culling cannot revive the SUN label after entering cosmic space");
  const picking = source.slice(
    source.indexOf("function pickDetail("),
    source.indexOf("function satellitePointerMove", source.indexOf("function pickDetail("))
  );
  assert.match(picking, /const solarDetailInteractive\s*=\s*isSolarAtlasDetailInteractive\(\)/);
  assert.match(picking, /const pickRoots\s*=\s*solarDetailInteractive\s*\?\s*\[planet\]\s*:\s*\[\]/,
    "hidden solar bodies cannot retain invisible raycast authority in Galaxy or Universe");
});


test("Earth clouds apply authored coverage once and atmosphere fades through a color-managed shell", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf('} else if (kind === "clouds"');
  const clouds = source.slice(start, source.indexOf('} else if (kind === "night"', start));
  assert.match(clouds, /alphaMap: texture/);
  assert.doesNotMatch(clouds, /\bmap: texture/,
    "multiplying cloud RGB by its coverage again erases thin weather patterns");
  assert.match(source, /\["clouds", surfaceHooks[.]clouds, false\]/,
    "coverage is non-color data and must not receive sRGB conversion");
  const atmosphere = source.slice(source.indexOf("atmosphereMaterial = new THREE.ShaderMaterial("), source.indexOf("function orientSite("));
  assert.doesNotMatch(atmosphere, /side: THREE[.]BackSide/,
    "the atmosphere uses ShaderMaterial's default front-facing shell");
  assert.match(atmosphere, /smoothstep\(0[.]0,0[.]28,facing\)/,
    "atmosphere must reach zero density at the outer silhouette instead of drawing a solid ring");
  assert.match(atmosphere, /#include <tonemapping_fragment>\r?\n#include <colorspace_fragment>/);
});
