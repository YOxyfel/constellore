import {
  SOLAR_PLANET_ORDER,
  VOYAGE_DURATION_SECONDS,
  createVoyageWorldPresentation,
  shotAtTime
} from "./voyage-projection-domain.mjs?v=5.0.0-beta.4";

const TAU = Math.PI * 2;

export const VOYAGE_SCENE_QUALITIES = Object.freeze(["low", "standard", "fallback"]);

export const VOYAGE_BODY_LAYOUT = deepFreeze([
  { id: "sun", kind: "star", radius: 3.2, orbitRadius: 0, color: 0xffb347, emissive: 0xff8a1f, spinRate: 0.025 },
  { id: "mercury", kind: "planet", radius: 0.18, orbitRadius: 4.6, phase: 0.2, color: 0x9b9387, spinRate: 0.035 },
  { id: "venus", kind: "planet", radius: 0.42, orbitRadius: 6.1, phase: 1.15, color: 0xd8a95b, spinRate: -0.018 },
  { id: "earth", kind: "planet", radius: 0.46, orbitRadius: 8, phase: 0, color: 0x2a69b8, emissive: 0x09234c, spinRate: 0.05 },
  { id: "moon", kind: "satellite", parentId: "earth", radius: 0.125, orbitRadius: 0.9, phase: 1.1, color: 0xb8bdc5, spinRate: 0.012 },
  { id: "mars", kind: "planet", radius: 0.3, orbitRadius: 10.1, phase: 2.5, color: 0xb85335, spinRate: 0.047 },
  { id: "jupiter", kind: "planet", radius: 1.25, orbitRadius: 13.5, phase: 3.25, color: 0xcaa27c, spinRate: 0.12 },
  { id: "saturn", kind: "planet", radius: 1.05, orbitRadius: 17, phase: 4.05, color: 0xd5c084, spinRate: 0.1, rings: true },
  { id: "uranus", kind: "planet", radius: 0.7, orbitRadius: 20.1, phase: 4.8, color: 0x8fc9cf, spinRate: -0.06, rings: true },
  { id: "neptune", kind: "planet", radius: 0.68, orbitRadius: 23.3, phase: 5.45, color: 0x3159ae, spinRate: 0.065 }
]);

export const VOYAGE_BODY_SHADER_PROFILES = deepFreeze({
  mercury: { base: 0x817b73, detail: 0xb5aaa0, atmosphere: 0x9b9387, bands: 18, terrain: 0.78, seed: 1.7 },
  venus: { base: 0xa66b32, detail: 0xf0cf83, atmosphere: 0xf8d895, bands: 34, terrain: 0.18, seed: 2.3 },
  earth: { base: 0x123e75, detail: 0x3e895d, atmosphere: 0x65cfff, bands: 16, terrain: 0.86, seed: 3.1 },
  moon: { base: 0x777d85, detail: 0xd0d3d5, atmosphere: 0xb8bdc5, bands: 20, terrain: 0.72, seed: 4.2 },
  mars: { base: 0x71301f, detail: 0xd16f45, atmosphere: 0xe49b6c, bands: 20, terrain: 0.66, seed: 5.4 },
  jupiter: { base: 0x8f664c, detail: 0xe7c5a2, atmosphere: 0xffd4aa, bands: 78, terrain: 0.08, seed: 6.6 },
  saturn: { base: 0xa9905b, detail: 0xf0ddb0, atmosphere: 0xffe4a8, bands: 66, terrain: 0.05, seed: 7.8 },
  uranus: { base: 0x5f9ca5, detail: 0xb8e1df, atmosphere: 0x9ff5ef, bands: 48, terrain: 0.04, seed: 8.9 },
  neptune: { base: 0x17357e, detail: 0x5e83dc, atmosphere: 0x619cff, bands: 56, terrain: 0.12, seed: 10.1 }
});

// These are authored landmarks rather than procedural noise. During the warp
// shot they pass the camera in a stable order, so "different systems" reads as
// actual places crossed on the route instead of only faster star streaks.
export const VOYAGE_INTERSTELLAR_SYSTEMS = deepFreeze([
  // Keep the landmarks outside the central flight lane. They should read as
  // distant systems being crossed, never as flat discs attached to the ship.
  { id: "amber-binary", position: [-7.2, 2.8, -10], starColor: 0xffc66f, companionColor: 0xff7d52, radius: 0.3 },
  { id: "cyan-rim", position: [7, -2.4, -20], starColor: 0x8eeeff, companionColor: 0x355fcb, radius: 0.26 },
  { id: "violet-archipelago", position: [-7.8, 0.8, -31], starColor: 0xd0a3ff, companionColor: 0x814bd1, radius: 0.3 },
  { id: "white-dwarf", position: [6.4, 3.7, -42], starColor: 0xf4fbff, companionColor: 0x72d4e6, radius: 0.22 },
  { id: "red-frontier", position: [-5.5, -3.4, -54], starColor: 0xff8067, companionColor: 0xb83a56, radius: 0.34 }
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value, minimum)));
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function lerp3(start, end, progress) {
  return [
    lerp(start[0], end[0], progress),
    lerp(start[1], end[1], progress),
    lerp(start[2], end[2], progress)
  ];
}

function smoothstep(progress) {
  const value = clamp(progress, 0, 1);
  return value * value * (3 - 2 * value);
}

function bezier3(a, b, c, progress) {
  const first = lerp3(a, b, progress);
  const second = lerp3(b, c, progress);
  return lerp3(first, second, progress);
}

function normalizeQuality(value) {
  return VOYAGE_SCENE_QUALITIES.includes(value) ? value : "standard";
}

export function resolveVoyageSceneDpr({ quality = "standard", devicePixelRatio = 1 } = {}) {
  const cap = normalizeQuality(quality) === "low" ? 1.25 : 1.75;
  return clamp(devicePixelRatio, 0.5, cap);
}

/** Return the immutable cinematic solar layout, including the Moon satellite. */
export function createVoyageSystemLayout({ worldPresentation = null } = {}) {
  const presentation = worldPresentation || createVoyageWorldPresentation();
  const states = new Map((presentation.worlds || []).map((world) => [world.worldId, world]));
  const bodies = VOYAGE_BODY_LAYOUT.map((body) => {
    const state = states.get(body.id) || null;
    const position = body.parentId
      ? [Math.cos(body.phase) * body.orbitRadius, 0.06, Math.sin(body.phase) * body.orbitRadius]
      : [Math.cos(body.phase || 0) * body.orbitRadius, 0, Math.sin(body.phase || 0) * body.orbitRadius];
    return {
      ...body,
      position,
      status: body.id === "sun" ? "environment" : state?.status || "locked",
      materialized: body.id === "sun" || Boolean(state?.materialized),
      actionable: Boolean(state?.actionable),
      locked: body.id === "sun" ? false : state?.locked !== false
    };
  });
  return deepFreeze({
    bodies,
    planetIds: [...SOLAR_PLANET_ORDER],
    satelliteIds: ["moon"]
  });
}

function shotVisibility(shotId) {
  const values = {
    earth: { solar: true, rocket: true, stars: true },
    solar: { solar: true, rocket: true, stars: true, debris: true },
    // The solar bodies are already behind the vessel at the heliopause. A
    // stray dark sphere in this plate reads as an artifact, not useful scale.
    heliopause: { rocket: true, stars: true, debris: true, heliopause: true },
    warp: { rocket: true, stars: true, warp: true, systems: true },
    "black-hole": { rocket: true, stars: true, debris: true, blackHole: true },
    singularity: { rocket: true, stars: true, blackHole: true },
    return: { solar: true, rocket: true, stars: true },
    beyond: { rocket: true, stars: true, beyondField: true }
  };
  return deepFreeze({
    solar: false,
    rocket: false,
    stars: false,
    debris: false,
    heliopause: false,
    warp: false,
    systems: false,
    blackHole: false,
    beyondField: false,
    ...(values[shotId] || values.earth)
  });
}

/**
 * Resolve a deterministic camera/object plate for a runtime snapshot. The
 * reduced-motion version holds a composed midpoint in every shot rather than
 * interpolating camera travel.
 */
export function resolveVoyageProjectionFrame(projectionSnapshot = {}) {
  const variant = projectionSnapshot.variant || "promise";
  const timelineSeconds = clamp(projectionSnapshot.timelineSeconds, 0, VOYAGE_DURATION_SECONDS);
  const shot = projectionSnapshot.shot || shotAtTime(timelineSeconds, { variant });
  const rawProgress = clamp(shot.progress, 0, 1);
  const reducedMotion = Boolean(projectionSnapshot.reducedMotion);
  const progress = reducedMotion ? 0.5 : smoothstep(rawProgress);
  let camera;
  let rocket;

  switch (shot.id) {
    case "solar":
      rocket = {
        position: bezier3([8.6, 5, -1.2], [13, 4.3, -4], [23.5, 3.5, -9], progress),
        rotation: [0.18, -0.42, -0.22],
        flame: 1,
        visualScale: lerp(2.4, 3, progress)
      };
      camera = {
        // Hold the Sun inside the left third and the departing rocket in the
        // right third. The old target drifted so far right that both anchors
        // were clipped while the empty star field occupied the frame.
        position: lerp3([13, 7.2, 23], [10.5, 14, 40], progress),
        target: lerp3([7, 2.8, -1.5], [12, 2.4, -6.5], progress),
        fov: lerp(54, 58, progress)
      };
      break;
    case "heliopause":
      rocket = {
        // Project the ship onto the shell's tangent while keeping it closer
        // than the shell itself. This preserves a hero silhouette without
        // flattening the curved boundary into a full-frame wash.
        position: lerp3([46.6, 8, 40.8], [53.52, 5.64, 41.2], progress),
        rotation: [0.06, -0.7, -0.08],
        flame: 1,
        visualScale: lerp(2.8, 3, progress)
      };
      camera = {
        // View the spherical boundary close to a tangent. Looking from inside
        // the shell reduced it to a uniform cyan wash; this outside angle puts
        // a curved luminous limb directly across the rocket's crossing point.
        position: lerp3([62, 11, 74], [68, 9, 78], progress),
        target: lerp3([23.5, 3.5, -9], [31.8, 0.6, -14], progress),
        fov: lerp(56, 58, progress)
      };
      break;
    case "warp":
      rocket = {
        position: [0, -0.4, lerp(1.2, -6.5, progress)],
        rotation: [Math.PI / 2, 0, -0.06],
        flame: 1.2,
        visualScale: 1.7
      };
      camera = {
        position: [0.3, 0.8, 8.8],
        target: [0, -0.15, -8],
        fov: lerp(50, 57, progress)
      };
      break;
    case "black-hole":
      rocket = {
        position: bezier3([-4.8, 1.4, 8], [-2.2, 1.1, 5.8], [-0.85, 0.4, 3.5], progress),
        rotation: [0.1, -0.25, -0.1],
        flame: lerp(1, 0.55, progress),
        visualScale: 1.55
      };
      camera = {
        position: lerp3([0, 3, 22], [0, 1.4, 14], progress),
        target: [0, 0, 0],
        fov: lerp(46, 52, progress)
      };
      break;
    case "singularity":
      rocket = {
        position: lerp3([-1.2, 0.4, 3.5], [0, 0, 0.25], progress),
        rotation: [0, 0, lerp(-0.1, 0.25, progress)],
        flame: lerp(0.5, 0, progress),
        visualScale: 1.2
      };
      camera = {
        position: lerp3([0, 1.4, 14], [0, 0.35, 5.8], progress),
        target: [0, 0, 0],
        fov: lerp(52, 59, progress)
      };
      break;
    case "return":
      rocket = {
        position: bezier3([8, 6.4, -1], [8.4, 3.4, 0.6], [8, 0.62, 0], progress),
        rotation: [0, 0, Math.PI],
        flame: lerp(0.75, 0.12, progress),
        visualScale: 0.72
      };
      camera = {
        position: lerp3([13, 6.2, 10], [10.9, 1.25, 5.4], progress),
        target: lerp3([8, 3, 0], [8, 0.5, 0], progress),
        fov: 43
      };
      break;
    case "beyond":
      rocket = {
        // The camera advances with the rocket so the ship remains a readable
        // human-scale reference while the uncharted destination grows ahead.
        position: lerp3([-2.7, -1.5, 1], [-1.2, -0.7, -24], progress),
        rotation: [Math.PI / 2, 0, -0.08],
        flame: 1.25,
        visualScale: 1.75
      };
      camera = {
        position: lerp3([0.8, 1.7, 9], [0.6, 1.3, -12.5], progress),
        // Open on the ship itself, then hand the eye to the destination. A
        // distant target from frame one pushed the nearby rocket outside the
        // lower-left safe frame because of parallax.
        target: lerp3([-2.7, -1.5, 1], [-0.55, -0.35, -34], progress),
        fov: lerp(48, 44, progress)
      };
      break;
    case "earth":
    default:
      rocket = {
        position: bezier3([8, 0.82, 0], [8.05, 0.95, -0.05], [8.6, 5, -1.2], progress),
        rotation: [0, 0, 0],
        flame: lerp(0.12, 0.88, progress),
        visualScale: lerp(0.68, 0.82, progress)
      };
      camera = {
        // Compose an Earth horizon and a complete launch silhouette. The
        // wider legacy lens made both subjects feel detached and miniature.
        position: lerp3([9.7, 1.5, 5.1], [11, 3.1, 6.2], progress),
        target: lerp3([8, 0.9, 0], [8.25, 2.6, -0.3], progress),
        fov: lerp(48, 50, progress)
      };
      break;
  }

  return deepFreeze({
    shotId: shot.id,
    shotProgress: rawProgress,
    choreographyProgress: progress,
    timelineSeconds,
    reducedMotion,
    camera,
    rocket,
    visibility: shotVisibility(shot.id),
    effects: {
      starRotation: reducedMotion ? 0 : timelineSeconds * 0.002,
      debrisRotation: reducedMotion ? 0 : timelineSeconds * -0.006,
      warpOffset: reducedMotion ? 0.35 : shot.id === "beyond" ? progress * 0.35 : progress,
      systemTransitOffset: reducedMotion ? 9 : shot.id === "beyond" ? progress * 18 : progress * 42,
      systemRoutePulse: reducedMotion
        ? 0.012
        : 0.012 + Math.sin(timelineSeconds * 3.2) * 0.004,
      accretionRotation: reducedMotion ? 0 : timelineSeconds * 0.11,
      heliopausePulse: reducedMotion ? 0.34 : 0.3 + Math.sin(timelineSeconds * 2.4) * 0.045,
      beyondRotation: reducedMotion ? 0 : timelineSeconds * 0.008,
      solarFocus: shot.id === "earth" || shot.id === "return" ? "earth" : "all",
      earthPlateScale: shot.id === "earth" ? 2.15 : 1
    }
  });
}

function setVector(target, values) {
  if (!target || !values) return;
  if (typeof target.set === "function") target.set(values[0], values[1], values[2]);
  else {
    target.x = values[0];
    target.y = values[1];
    target.z = values[2];
  }
}

function setEuler(target, values) {
  setVector(target, values);
}

function deterministicRandom(seed = 0x51f15e) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function materialList(material) {
  return Array.isArray(material) ? material : material ? [material] : [];
}

function disposeMaterial(material) {
  for (const entry of materialList(material)) {
    for (const value of Object.values(entry || {})) {
      if (value?.isTexture && typeof value.dispose === "function") value.dispose();
    }
    entry?.dispose?.();
  }
}

function safeInvoke(callback, args, onError, source) {
  if (typeof callback !== "function") return;
  try {
    callback(...args);
  } catch (error) {
    try { onError?.(error, { source }); } catch { /* Error callbacks are isolated. */ }
  }
}

/** Create the lazy, frame-driven real-time Voyage Projection scene. */
export function createVoyageProjectionScene({
  canvas,
  THREE,
  quality = "standard",
  reducedMotion = false,
  devicePixelRatio = globalThis.devicePixelRatio || 1,
  onReady = null,
  onFallback = null,
  onError = null,
  onRender = null
} = {}) {
  const normalizedQuality = normalizeQuality(quality);
  const dpr = resolveVoyageSceneDpr({ quality: normalizedQuality, devicePixelRatio });
  const resources = new Set();
  const suspendReasons = new Set();
  const bodies = new Map();
  let renderer = null;
  let scene = null;
  let camera = null;
  let groups = null;
  let rocketFlame = null;
  let prepared = false;
  let destroyed = false;
  let renderCount = 0;
  let width = 1;
  let height = 1;
  let phase = "idle";
  let fallbackReason = null;
  let currentFrame = resolveVoyageProjectionFrame({ reducedMotion, timelineSeconds: 0 });
  let worldPresentation = createVoyageWorldPresentation();

  canvas?.setAttribute?.("aria-hidden", "true");
  canvas?.setAttribute?.("tabindex", "-1");
  canvas?.setAttribute?.("inert", "");
  try { if (canvas) canvas.inert = true; } catch { /* Older canvases may reject inert assignment. */ }
  if (canvas?.style) canvas.style.pointerEvents = "none";

  function sceneSnapshot() {
    return deepFreeze({
      phase,
      quality: normalizedQuality,
      dpr,
      reducedMotion: Boolean(reducedMotion),
      prepared,
      destroyed,
      suspended: suspendReasons.size > 0,
      suspendReasons: [...suspendReasons],
      width,
      height,
      shotId: currentFrame.shotId,
      shotProgress: currentFrame.shotProgress,
      timelineSeconds: currentFrame.timelineSeconds,
      renderCount,
      fallbackReason,
      bodyIds: [...bodies.keys()]
    });
  }

  function track(resource) {
    if (resource && typeof resource === "object") resources.add(resource);
    return resource;
  }

  function makeMaterial(type, options) {
    const Material = THREE?.[type] || THREE?.MeshBasicMaterial;
    return track(new Material(options));
  }

  function makeMesh(geometry, material) {
    track(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }

  function makePointField({ count, radius, size, color, seed }) {
    const random = deterministicRandom(seed);
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const distance = radius * (0.35 + random() * 0.65);
      const theta = random() * TAU;
      const z = random() * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - z * z));
      positions[index * 3] = Math.cos(theta) * radial * distance;
      positions[index * 3 + 1] = z * distance;
      positions[index * 3 + 2] = Math.sin(theta) * radial * distance;
    }
    const geometry = track(new THREE.BufferGeometry());
    const Attribute = THREE.Float32BufferAttribute || THREE.BufferAttribute;
    geometry.setAttribute("position", new Attribute(positions, 3));
    const material = makeMaterial("PointsMaterial", {
      color,
      size,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      sizeAttenuation: true
    });
    return new THREE.Points(geometry, material);
  }

  function makeWarpField() {
    const random = deterministicRandom(0x7a11c0de);
    const count = normalizedQuality === "low" ? 60 : 110;
    const positions = new Float32Array(count * 6);
    for (let index = 0; index < count; index += 1) {
      const x = (random() - 0.5) * 22;
      const y = (random() - 0.5) * 13;
      const z = -random() * 45;
      const offset = index * 6;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
      positions[offset + 3] = x;
      positions[offset + 4] = y;
      positions[offset + 5] = z - (2.2 + random() * 7);
    }
    const geometry = track(new THREE.BufferGeometry());
    const Attribute = THREE.Float32BufferAttribute || THREE.BufferAttribute;
    geometry.setAttribute("position", new Attribute(positions, 3));
    const material = makeMaterial("LineBasicMaterial", {
      color: 0x9edfff,
      transparent: true,
      opacity: 0.24,
      depthWrite: false
    });
    return new THREE.LineSegments(geometry, material);
  }

  function makeInterstellarSystems() {
    const corridor = new THREE.Group();
    corridor.name = "voyage-interstellar-systems";
    const routePositions = [];
    const starSegments = normalizedQuality === "low" ? 12 : 18;

    for (const [index, system] of VOYAGE_INTERSTELLAR_SYSTEMS.entries()) {
      const group = new THREE.Group();
      group.name = `voyage-system-${system.id}`;
      setVector(group.position, system.position);

      const star = makeMesh(
        new THREE.SphereGeometry(system.radius, starSegments, Math.max(8, Math.floor(starSegments * 0.65))),
        makeMaterial("MeshBasicMaterial", { color: system.starColor })
      );
      const glow = makeMesh(
        new THREE.SphereGeometry(system.radius * 1.32, starSegments, Math.max(8, Math.floor(starSegments * 0.65))),
        makeMaterial("MeshBasicMaterial", {
          color: system.starColor,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.BackSide
        })
      );
      star.add(glow);
      group.add(star);

      if (THREE.RingGeometry) {
        const orbit = makeMesh(
          new THREE.RingGeometry(system.radius * 1.9, system.radius * 1.93, starSegments * 2),
          makeMaterial("MeshBasicMaterial", {
            color: 0x6edce8,
            transparent: true,
            opacity: 0.26,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        );
        orbit.rotation.x = Math.PI * (0.36 + index * 0.035);
        group.add(orbit);
      }

      const companion = makeMesh(
        new THREE.SphereGeometry(system.radius * 0.22, 10, 8),
        makeMaterial("MeshBasicMaterial", { color: system.companionColor })
      );
      companion.position.x = system.radius * 1.9;
      companion.position.y = system.radius * (index % 2 ? -0.36 : 0.34);
      group.add(companion);
      corridor.add(group);
      routePositions.push(...system.position);
    }

    if (routePositions.length >= 6) {
      const segments = new Float32Array((VOYAGE_INTERSTELLAR_SYSTEMS.length - 1) * 6);
      for (let index = 0; index < VOYAGE_INTERSTELLAR_SYSTEMS.length - 1; index += 1) {
        const start = VOYAGE_INTERSTELLAR_SYSTEMS[index].position;
        const end = VOYAGE_INTERSTELLAR_SYSTEMS[index + 1].position;
        segments.set([...start, ...end], index * 6);
      }
      const routeGeometry = track(new THREE.BufferGeometry());
      const Attribute = THREE.Float32BufferAttribute || THREE.BufferAttribute;
      routeGeometry.setAttribute("position", new Attribute(segments, 3));
      const routeMaterial = makeMaterial("LineBasicMaterial", {
        color: 0x79e3ec,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const route = new THREE.LineSegments(routeGeometry, routeMaterial);
      route.name = "voyage-interstellar-route";
      corridor.userData = { ...(corridor.userData || {}), route, systemCount: VOYAGE_INTERSTELLAR_SYSTEMS.length };
      corridor.add(route);
    }

    return corridor;
  }

  function makeRocket() {
    const group = new THREE.Group();
    group.name = "voyage-rocket";
    const bodyMaterial = makeMaterial("MeshStandardMaterial", {
      color: 0xdbe8ee,
      metalness: 0.7,
      roughness: 0.24,
      emissive: 0x07121d,
      emissiveIntensity: 0.35
    });
    const trimMaterial = makeMaterial("MeshStandardMaterial", {
      color: 0x48d5e7,
      emissive: 0x0c8498,
      emissiveIntensity: 1.2,
      metalness: 0.45,
      roughness: 0.28
    });
    const body = makeMesh(new THREE.CylinderGeometry(0.18, 0.25, 1.25, 14), bodyMaterial);
    const nose = makeMesh(new THREE.ConeGeometry(0.18, 0.48, 14), bodyMaterial);
    nose.position.y = 0.86;
    const collar = makeMesh(new THREE.CylinderGeometry(0.27, 0.27, 0.15, 14), trimMaterial);
    collar.position.y = -0.54;
    const flameMaterial = makeMaterial("MeshBasicMaterial", {
      color: 0xffc261,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    rocketFlame = makeMesh(new THREE.ConeGeometry(0.2, 0.85, 12), flameMaterial);
    rocketFlame.position.y = -1.05;
    rocketFlame.rotation.z = Math.PI;
    group.add(body, nose, collar, rocketFlame);
    group.userData = { ...(group.userData || {}), baseVisualScale: 0.72 };
    group.scale?.set?.(0.72, 0.72, 0.72);
    return group;
  }

  function shaderColor(value) {
    return typeof THREE.Color === "function" ? new THREE.Color(value) : value;
  }

  function makePlanetMaterial(body) {
    const profile = VOYAGE_BODY_SHADER_PROFILES[body.id];
    if (!profile || !THREE.ShaderMaterial) {
      return makeMaterial("MeshStandardMaterial", {
        color: body.color,
        emissive: body.emissive || 0x000000,
        emissiveIntensity: body.materialized ? 0.42 : 0.08,
        roughness: 0.82,
        metalness: 0.02,
        transparent: body.locked,
        opacity: body.locked ? 0.42 : 1
      });
    }
    return track(new THREE.ShaderMaterial({
      transparent: body.locked,
      depthWrite: !body.locked,
      uniforms: {
        uBase: { value: shaderColor(profile.base) },
        uDetail: { value: shaderColor(profile.detail) },
        uAtmosphere: { value: shaderColor(profile.atmosphere) },
        uBands: { value: profile.bands },
        uTerrain: { value: profile.terrain },
        uSeed: { value: profile.seed },
        uOpacity: { value: body.locked ? 0.42 : 1 },
        uActionGlow: { value: body.actionable ? 1 : body.materialized ? 0.45 : 0.08 },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormalView;
        varying vec3 vObjectNormal;
        varying vec3 vObjectPosition;
        void main() {
          vNormalView = normalize(normalMatrix * normal);
          vObjectNormal = normalize(normal);
          vObjectPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormalView;
        varying vec3 vObjectNormal;
        varying vec3 vObjectPosition;
        uniform vec3 uBase;
        uniform vec3 uDetail;
        uniform vec3 uAtmosphere;
        uniform float uBands;
        uniform float uTerrain;
        uniform float uSeed;
        uniform float uOpacity;
        uniform float uActionGlow;
        uniform float uTime;

        float hashField(vec3 p) {
          return sin(p.x * (7.1 + uSeed) + sin(p.z * 9.7 - uSeed))
            + cos(p.z * (5.3 + uSeed * 0.7) - p.y * 11.0)
            + sin((p.x + p.z) * 13.0 + uSeed * 2.1);
        }

        void main() {
          vec3 n = normalize(vObjectNormal);
          float longitude = atan(n.z, n.x);
          float band = 0.5 + 0.5 * sin(n.y * uBands + sin(longitude * 4.0 + uSeed) * 1.4);
          float terrain = smoothstep(-0.25, 0.72, hashField(n * 1.8));
          float pattern = mix(band, terrain, uTerrain);
          vec3 surface = mix(uBase, uDetail, pattern * 0.82);
          vec3 lightDirection = normalize(vec3(0.72, 0.48, 0.64));
          float diffuse = max(dot(n, lightDirection), 0.0);
          float dusk = smoothstep(-0.18, 0.34, dot(n, lightDirection));
          float rim = pow(1.0 - abs(vNormalView.z), 3.2);
          float cloud = 0.5 + 0.5 * sin(hashField(n * 2.7) * 2.3 + uTime * 0.04);
          surface = mix(surface, uAtmosphere, cloud * 0.07 * (0.25 + uTerrain));
          vec3 lit = surface * (0.14 + diffuse * 1.08) * mix(0.48, 1.0, dusk);
          lit += uAtmosphere * rim * (0.2 + uActionGlow * 0.34);
          gl_FragColor = vec4(lit, uOpacity);
        }
      `
    }));
  }

  function addAtmosphere(mesh, body, segments) {
    const profile = VOYAGE_BODY_SHADER_PROFILES[body.id];
    if (!profile || !THREE.ShaderMaterial) return;
    const material = track(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: shaderColor(profile.atmosphere) },
        uStrength: { value: body.actionable ? 0.44 : body.materialized ? 0.25 : 0.08 },
        uOpacity: { value: body.locked ? 0.42 : 1 }
      },
      vertexShader: `
        varying vec3 vNormalView;
        void main() {
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormalView;
        uniform vec3 uColor;
        uniform float uStrength;
        uniform float uOpacity;
        void main() {
          float rim = pow(1.0 - abs(vNormalView.z), 2.5);
          gl_FragColor = vec4(uColor, rim * uStrength * uOpacity);
        }
      `
    }));
    const shell = makeMesh(
      new THREE.SphereGeometry(body.radius * 1.055, segments, Math.max(12, Math.floor(segments * 0.65))),
      material
    );
    shell.name = `voyage-atmosphere-${body.id}`;
    mesh.userData.atmosphere = shell;
    mesh.add(shell);
  }

  function addSolarCorona(mesh, radius, segments) {
    const coronaMaterial = makeMaterial("MeshBasicMaterial", {
      color: 0xffa33d,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide
    });
    const corona = makeMesh(
      new THREE.SphereGeometry(radius * 1.13, segments, Math.max(12, Math.floor(segments * 0.65))),
      coronaMaterial
    );
    corona.name = "voyage-solar-corona";
    mesh.userData.corona = corona;
    mesh.add(corona);
  }

  function makeSolarSystem() {
    const solar = new THREE.Group();
    solar.name = "voyage-solar-system";
    const layout = createVoyageSystemLayout({ worldPresentation });
    const parents = new Map();

    for (const body of layout.bodies) {
      const segments = normalizedQuality === "low" ? 18 : 28;
      const geometry = new THREE.SphereGeometry(body.radius, segments, Math.max(12, Math.floor(segments * 0.65)));
      const material = body.kind === "star"
        ? makeMaterial("MeshBasicMaterial", { color: body.color })
        : makePlanetMaterial(body);
      const mesh = makeMesh(geometry, material);
      mesh.name = `voyage-body-${body.id}`;
      mesh.userData = {
        ...(mesh.userData || {}),
        bodyId: body.id,
        spinRate: body.spinRate,
        baseOpacity: body.locked ? 0.42 : 1,
        baseVisualScale: 1
      };
      setVector(mesh.position, body.position);
      bodies.set(body.id, mesh);
      if (body.parentId) {
        (parents.get(body.parentId) || solar).add(mesh);
      } else {
        solar.add(mesh);
        parents.set(body.id, mesh);
      }

      if (body.kind === "star") addSolarCorona(mesh, body.radius, segments);
      else addAtmosphere(mesh, body, segments);

      if (body.rings && THREE.RingGeometry) {
        const ring = makeMesh(
          new THREE.RingGeometry(body.radius * 1.35, body.radius * 2, segments * 2),
          makeMaterial("MeshBasicMaterial", {
            color: body.id === "uranus" ? 0x85c7cf : 0xcdb879,
            transparent: true,
            opacity: 0.58,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        );
        ring.rotation.x = Math.PI * 0.47;
        mesh.add(ring);
      }
    }
    return solar;
  }

  function makeHeliopause() {
    const geometry = new THREE.SphereGeometry(28.5, normalizedQuality === "low" ? 18 : 28, 14);
    const material = THREE.ShaderMaterial
      ? track(new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: shaderColor(0x55d7e5) },
          uPulse: { value: 0.3 }
        },
        vertexShader: `
          varying vec3 vNormalView;
          void main() {
            vNormalView = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormalView;
          uniform vec3 uColor;
          uniform float uPulse;
          void main() {
            float rim = pow(1.0 - abs(vNormalView.z), 3.4);
            float veil = pow(1.0 - abs(vNormalView.z), 9.0) * 0.35;
            gl_FragColor = vec4(uColor * (0.7 + rim), (rim + veil) * uPulse);
          }
        `
      }))
      : makeMaterial("MeshBasicMaterial", {
        color: 0x3fb7cf,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        depthWrite: false
      });
    return makeMesh(geometry, material);
  }

  function makeBeyondField() {
    const group = new THREE.Group();
    group.name = "voyage-beyond-field";
    const segments = normalizedQuality === "low" ? 24 : 48;
    const core = makeMesh(
      new THREE.SphereGeometry(0.68, segments, Math.max(12, Math.floor(segments * 0.6))),
      makeMaterial("MeshBasicMaterial", {
        color: 0x35d2cb,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    setVector(core.position, [0, 0, -34]);
    let hazeMaterial;
    if (THREE.ShaderMaterial) {
      hazeMaterial = track(new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColorA: { value: shaderColor(0x2b9ea8) },
          uColorB: { value: shaderColor(0x7550a8) }
        },
        vertexShader: `
          varying vec3 vLocal;
          varying vec3 vNormalView;
          void main() {
            vLocal = position;
            vNormalView = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vLocal;
          varying vec3 vNormalView;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          void main() {
            float cloud = 0.5 + 0.5 * sin(vLocal.x * 1.7 + sin(vLocal.y * 2.1) + vLocal.z * 1.25);
            cloud *= 0.62 + 0.38 * sin(vLocal.y * 2.7 - vLocal.z * 1.4);
            float rim = pow(1.0 - abs(vNormalView.z), 2.2);
            float alpha = (0.025 + max(0.0, cloud) * 0.075) * (0.3 + rim);
            gl_FragColor = vec4(mix(uColorA, uColorB, clamp(cloud, 0.0, 1.0)), alpha);
          }
        `
      }));
    } else {
      hazeMaterial = makeMaterial("MeshBasicMaterial", {
        color: 0x4c759d,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
    }
    const glow = makeMesh(
      new THREE.SphereGeometry(7.2, segments, Math.max(12, Math.floor(segments * 0.6))),
      hazeMaterial
    );
    setVector(glow.position, [0, 0, -34]);
    glow.scale?.set?.(1.55, 0.66, 1);
    group.add(core, glow);

    const landmarks = [
      [-5.2, 1.8, -35.5, 0.22, 0x83d9ee],
      [4.7, -2.1, -37.2, 0.17, 0xd0a5ff],
      [2.8, 4.1, -39.5, 0.13, 0x8ff3cf],
      [-2.1, -4.4, -40.8, 0.1, 0xffc47a]
    ];
    for (const [x, y, z, radius, color] of landmarks) {
      const landmark = makeMesh(
        new THREE.SphereGeometry(radius, 12, 8),
        makeMaterial("MeshBasicMaterial", {
          color,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      setVector(landmark.position, [x, y, z]);
      group.add(landmark);
    }
    return group;
  }

  function makeBlackHole() {
    const group = new THREE.Group();
    group.name = "voyage-black-hole";
    const core = makeMesh(
      new THREE.SphereGeometry(1.65, normalizedQuality === "low" ? 24 : 40, 20),
      makeMaterial("MeshBasicMaterial", { color: 0x000000 })
    );
    group.add(core);

    const ringGeometry = new THREE.RingGeometry(1.75, 5.2, normalizedQuality === "low" ? 48 : 96, 4);
    let accretionMaterial;
    if (THREE.ShaderMaterial) {
      accretionMaterial = track(new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uIntensity: { value: 1 } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uIntensity;
          void main() {
            vec2 p = vUv - 0.5;
            float r = length(p) * 2.0;
            float filament = 0.72 + 0.28 * sin(atan(p.y, p.x) * 11.0 + r * 19.0);
            float alpha = smoothstep(1.0, 0.08, abs(r - 0.62)) * filament;
            vec3 cool = vec3(0.16, 0.55, 1.0);
            vec3 hot = vec3(1.0, 0.54, 0.12);
            gl_FragColor = vec4(mix(hot, cool, smoothstep(0.38, 0.9, r)) * uIntensity, alpha * 0.88);
          }
        `
      }));
    } else {
      accretionMaterial = makeMaterial("MeshBasicMaterial", {
        color: 0xff8a32,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
    }
    const disk = makeMesh(ringGeometry, accretionMaterial);
    disk.name = "voyage-accretion-disk";
    group.userData = { ...(group.userData || {}), accretionDisk: disk };
    group.add(disk);

    if (THREE.TorusGeometry) {
      const photonRing = makeMesh(
        new THREE.TorusGeometry(1.72, 0.035, 8, normalizedQuality === "low" ? 48 : 96),
        makeMaterial("MeshBasicMaterial", {
          color: 0xffd58a,
          transparent: true,
          opacity: 0.24,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      group.add(photonRing);
    }
    return group;
  }

  function addLights() {
    if (THREE.AmbientLight) scene.add(new THREE.AmbientLight(0x23314e, 1.35));
    if (THREE.DirectionalLight) {
      const key = new THREE.DirectionalLight(0xdcecff, 2.15);
      setVector(key.position, [9, 13, 11]);
      key.castShadow = false;
      scene.add(key);
    }
    if (THREE.PointLight) {
      const sunLight = new THREE.PointLight(0xffb65b, 6, 48, 1.35);
      setVector(sunLight.position, [0, 0, 0]);
      sunLight.castShadow = false;
      scene.add(sunLight);
    }
  }

  function buildScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 180);
    groups = {
      solar: makeSolarSystem(),
      rocket: makeRocket(),
      stars: makePointField({
        count: normalizedQuality === "low" ? 700 : 1500,
        radius: 78,
        size: normalizedQuality === "low" ? 0.09 : 0.065,
        color: 0xd9edff,
        seed: 0x51f15e
      }),
      debris: makePointField({
        count: normalizedQuality === "low" ? 110 : 260,
        radius: 34,
        size: 0.13,
        color: 0x6f829c,
        seed: 0xde8715
      }),
      heliopause: makeHeliopause(),
      warp: makeWarpField(),
      systems: makeInterstellarSystems(),
      blackHole: makeBlackHole(),
      beyondField: makeBeyondField()
    };
    for (const group of Object.values(groups)) scene.add(group);
    addLights();
  }

  function dispose() {
    for (const resource of resources) {
      if (resource?.isMaterial || /Material$/.test(resource?.constructor?.name || "")) {
        disposeMaterial(resource);
      } else resource?.dispose?.();
    }
    resources.clear();
    renderer?.dispose?.();
    renderer = null;
    scene = null;
    camera = null;
    groups = null;
    bodies.clear();
    rocketFlame = null;
  }

  function handleError(error, source) {
    safeInvoke(onError, [error, deepFreeze({ source, snapshot: sceneSnapshot() })], null, "error");
  }

  function enterFallback(reason = "scene-unavailable", error = null) {
    if (destroyed || phase === "fallback") return false;
    fallbackReason = String(reason || "scene-unavailable");
    phase = "fallback";
    prepared = false;
    if (error) handleError(error, "fallback");
    dispose();
    safeInvoke(onFallback, [deepFreeze({ reason: fallbackReason, error, snapshot: sceneSnapshot() })], onError, "fallback-callback");
    return true;
  }

  function render() {
    if (!prepared || destroyed || phase !== "ready" || suspendReasons.size || !renderer || !scene || !camera) return false;
    try {
      renderer.render(scene, camera);
      renderCount += 1;
      safeInvoke(onRender, [sceneSnapshot()], onError, "render-callback");
      return true;
    } catch (error) {
      enterFallback("render-failed", error);
      return false;
    }
  }

  function applyWorldPresentation(presentation) {
    const states = new Map((presentation?.worlds || []).map((world) => [world.worldId, world]));
    for (const [bodyId, mesh] of bodies) {
      if (bodyId === "sun") continue;
      const world = states.get(bodyId);
      if (!world || !mesh.material) continue;
      const opacity = world.materialized || world.actionable ? 1 : 0.42;
      for (const material of materialList(mesh.material)) {
        material.transparent = opacity < 1;
        material.opacity = opacity;
        material.depthWrite = opacity >= 1;
        if ("emissiveIntensity" in material) material.emissiveIntensity = world.actionable ? 0.52 : world.materialized ? 0.28 : 0.06;
        if (material.uniforms?.uOpacity) material.uniforms.uOpacity.value = opacity;
        if (material.uniforms?.uActionGlow) {
          material.uniforms.uActionGlow.value = world.actionable ? 1 : world.materialized ? 0.45 : 0.08;
        }
        material.needsUpdate = true;
      }
      const atmosphereMaterial = mesh.userData?.atmosphere?.material;
      if (atmosphereMaterial?.uniforms?.uOpacity) atmosphereMaterial.uniforms.uOpacity.value = opacity;
      if (atmosphereMaterial?.uniforms?.uStrength) {
        atmosphereMaterial.uniforms.uStrength.value = world.actionable ? 0.44 : world.materialized ? 0.25 : 0.08;
      }
    }
  }

  function applyFrame(frame) {
    if (!groups || !camera) return;
    const visibility = frame.visibility;
    groups.solar.visible = visibility.solar;
    groups.rocket.visible = visibility.rocket;
    groups.stars.visible = visibility.stars;
    groups.debris.visible = visibility.debris;
    groups.heliopause.visible = visibility.heliopause;
    groups.warp.visible = visibility.warp;
    groups.systems.visible = visibility.systems;
    groups.blackHole.visible = visibility.blackHole;
    groups.beyondField.visible = visibility.beyondField;

    setVector(camera.position, frame.camera.position);
    camera.fov = frame.camera.fov;
    camera.updateProjectionMatrix?.();
    camera.lookAt?.(...frame.camera.target);
    setVector(groups.rocket.position, frame.rocket.position);
    setEuler(groups.rocket.rotation, frame.rocket.rotation);
    const rocketScale = finite(groups.rocket.userData?.baseVisualScale, 0.72)
      * clamp(frame.rocket.visualScale, 0.25, 3);
    groups.rocket.scale?.set?.(rocketScale, rocketScale, rocketScale);
    if (rocketFlame) {
      rocketFlame.visible = frame.rocket.flame > 0.02;
      rocketFlame.scale?.set?.(1, Math.max(0.05, frame.rocket.flame), 1);
      if (rocketFlame.material) rocketFlame.material.opacity = clamp(frame.rocket.flame, 0, 1);
    }
    groups.stars.rotation.y = frame.effects.starRotation;
    groups.debris.rotation.y = frame.effects.debrisRotation;
    groups.warp.position.z = -frame.effects.warpOffset * 12;
    groups.systems.position.z = frame.effects.systemTransitOffset;
    const systemRoute = groups.systems.userData?.route;
    if (systemRoute?.material) systemRoute.material.opacity = frame.effects.systemRoutePulse;
    if (groups.heliopause.material?.uniforms?.uPulse) {
      groups.heliopause.material.uniforms.uPulse.value = frame.effects.heliopausePulse;
    } else if (groups.heliopause.material) groups.heliopause.material.opacity = frame.effects.heliopausePulse;
    const accretionDisk = groups.blackHole.userData?.accretionDisk;
    if (accretionDisk) accretionDisk.rotation.z = frame.effects.accretionRotation;
    const beyondRing = groups.beyondField.userData?.ring;
    if (beyondRing) beyondRing.rotation.z = frame.effects.beyondRotation;

    for (const [bodyId, mesh] of bodies.entries()) {
      mesh.visible = visibility.solar && (frame.effects.solarFocus !== "earth" || bodyId === "earth");
      const bodyScale = finite(mesh.userData?.baseVisualScale, 1)
        * (bodyId === "earth" ? finite(frame.effects.earthPlateScale, 1) : 1);
      mesh.scale?.set?.(bodyScale, bodyScale, bodyScale);
      const rate = finite(mesh.userData?.spinRate);
      if (!frame.reducedMotion) mesh.rotation.y = frame.timelineSeconds * rate;
      for (const material of materialList(mesh.material)) {
        if (material.uniforms?.uTime) material.uniforms.uTime.value = frame.timelineSeconds;
      }
      const coronaMaterial = mesh.userData?.corona?.material;
      if (coronaMaterial) {
        coronaMaterial.opacity = frame.reducedMotion
          ? 0.18
          : 0.16 + Math.sin(frame.timelineSeconds * 1.35) * 0.025;
      }
    }
  }

  function resize({
    width: nextWidth = canvas?.clientWidth || canvas?.width || width,
    height: nextHeight = canvas?.clientHeight || canvas?.height || height
  } = {}) {
    width = Math.max(1, Math.round(finite(nextWidth, width)));
    height = Math.max(1, Math.round(finite(nextHeight, height)));
    if (renderer) {
      renderer.setPixelRatio?.(dpr);
      renderer.setSize?.(width, height, false);
    }
    if (camera) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix?.();
    }
    render();
    return sceneSnapshot();
  }

  async function prepare({
    width: requestedWidth,
    height: requestedHeight
  } = {}) {
    if (destroyed) return sceneSnapshot();
    if (prepared) return sceneSnapshot();
    phase = "loading";
    if (normalizedQuality === "fallback") {
      enterFallback("quality-fallback");
      return sceneSnapshot();
    }
    if (!canvas || !THREE?.Scene || !THREE?.PerspectiveCamera || !THREE?.WebGLRenderer
      || !THREE?.Group || !THREE?.Mesh || !THREE?.SphereGeometry || !THREE?.MeshBasicMaterial) {
      enterFallback("three-unavailable");
      return sceneSnapshot();
    }
    try {
      width = Math.max(1, Math.round(finite(requestedWidth, canvas.clientWidth || canvas.width || 1)));
      height = Math.max(1, Math.round(finite(requestedHeight, canvas.clientHeight || canvas.height || 1)));
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: normalizedQuality === "standard",
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: true
      });
      renderer.setPixelRatio?.(dpr);
      renderer.setSize?.(width, height, false);
      renderer.setClearColor?.(0x02040d, 0);
      if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      if ("toneMapping" in renderer && THREE.ACESFilmicToneMapping !== undefined) renderer.toneMapping = THREE.ACESFilmicToneMapping;
      if (renderer.shadowMap) renderer.shadowMap.enabled = false;
      buildScene();
      prepared = true;
      phase = suspendReasons.size ? "suspended" : "ready";
      applyWorldPresentation(worldPresentation);
      applyFrame(currentFrame);
      render();
      safeInvoke(onReady, [sceneSnapshot()], onError, "ready-callback");
    } catch (error) {
      enterFallback("prepare-failed", error);
    }
    return sceneSnapshot();
  }

  function sync(projectionOrPayload = {}, nextWorldPresentation = null) {
    if (destroyed) return sceneSnapshot();
    const projectionSnapshot = projectionOrPayload?.projectionSnapshot
      || projectionOrPayload?.projection
      || projectionOrPayload;
    const presentation = nextWorldPresentation
      || projectionOrPayload?.worldPresentation
      || projectionOrPayload?.worlds
      || null;
    if (presentation) worldPresentation = presentation;
    currentFrame = resolveVoyageProjectionFrame({
      ...projectionSnapshot,
      reducedMotion: projectionSnapshot?.reducedMotion ?? reducedMotion
    });
    if (prepared) {
      applyWorldPresentation(worldPresentation);
      applyFrame(currentFrame);
      render();
    }
    return sceneSnapshot();
  }

  function suspend(reason = "manual") {
    if (destroyed || phase === "fallback") return false;
    suspendReasons.add(String(reason || "manual"));
    if (prepared) phase = "suspended";
    return sceneSnapshot();
  }

  function resume(reason = null) {
    if (destroyed || phase === "fallback") return false;
    if (reason === null) suspendReasons.clear();
    else suspendReasons.delete(String(reason));
    if (prepared && suspendReasons.size === 0) {
      phase = "ready";
      render();
    }
    return sceneSnapshot();
  }

  function contextLost(event) {
    event?.preventDefault?.();
    enterFallback("context-lost");
  }

  function destroy() {
    if (destroyed) return false;
    destroyed = true;
    canvas?.removeEventListener?.("webglcontextlost", contextLost);
    dispose();
    suspendReasons.clear();
    prepared = false;
    phase = "destroyed";
    return true;
  }

  canvas?.addEventListener?.("webglcontextlost", contextLost, false);

  return Object.freeze({
    prepare,
    sync,
    resize,
    suspend,
    resume,
    fallback: enterFallback,
    destroy,
    snapshot: sceneSnapshot
  });
}
