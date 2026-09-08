/**
 * An isolated presentation of the shipped planet/deep-space renderer.
 * This adapter never loads app.js, a player profile, or game persistence.
 * Resolve from this module so /play/ and packaged subdirectory builds agree.
 */
import { createThreePlanetHubRenderer } from './planet-hub-renderer.mjs?v=5.0.0-beta.4';
import * as sharedZoom from './planet-hub-zoom.mjs?v=5.0.0-beta.4';

const VERSION = '5.0.0-beta.4';
const publicUrl = (path) => new URL(path, import.meta.url).href;
const moduleUrl = (path) => publicUrl(`${path}?v=${VERSION}`);

export const WEBSITE_ATLAS_SCALES = Object.freeze([
  Object.freeze({ id: 'planet', label: 'Earth' }),
  Object.freeze({ id: 'orbit', label: 'Orbit' }),
  Object.freeze({ id: 'system', label: 'Solar system' }),
  Object.freeze({ id: 'stars', label: 'Nearby stars' }),
  Object.freeze({ id: 'milky-way', label: 'Milky Way' }),
  Object.freeze({ id: 'beyond', label: 'Cosmic web' })
]);

export async function mountWebsiteAtlas({
  container,
  onState = () => {},
  reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
  quality = globalThis.matchMedia?.('(max-width: 760px)').matches ? 'low' : 'standard'
} = {}) {
  if (!container?.append || !container.ownerDocument) {
    throw new TypeError('A dedicated preview container is required.');
  }
  const documentRef = container.ownerDocument;
  const windowRef = documentRef.defaultView;
  const stage = documentRef.createElement('div');
  stage.dataset.websiteAtlas = '';
  Object.assign(stage.style, { position: 'absolute', inset: '0', overflow: 'hidden', background: '#01060f' });
  const poster = documentRef.createElement('img');
  poster.src = publicUrl('./art/planet-hub/posters/earth-forge.webp');
  poster.alt = 'Earth and the Forge, artwork from the current game';
  Object.assign(poster.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover' });
  let canvas = documentRef.createElement('canvas');
  canvas.dataset.websiteAtlasCanvas = '';
  canvas.setAttribute('aria-label', 'Interactive atlas from Constellore. Drag to orbit, or use the arrow keys. Use the scale controls to travel outward.');
  canvas.tabIndex = 0;
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', opacity: '0', touchAction: 'pan-y pinch-zoom', cursor: 'grab' });
  const notice = documentRef.createElement('span');
  Object.assign(notice.style, { position: 'absolute', left: '18px', bottom: '18px', maxWidth: 'calc(100% - 36px)', padding: '8px 12px', font: '12px/1.5 system-ui, sans-serif', color: '#e5efff', background: '#07121ee6', border: '1px solid #a9c8ed33', borderRadius: '4px', pointerEvents: 'none' });
  stage.append(poster, canvas, notice);
  container.append(stage);

  let renderer = null;
  let rendererWorld = null;
  let resourcesPromise = null;
  let worldQueue = Promise.resolve();
  let worldPromise = null;
  let requestedWorld = null;
  let worldGeneration = 0;
  let operationGeneration = 0;
  let disposed = false;
  let manuallyPaused = false;
  let inViewport = true;
  let pointer = null;
  let stillFrame = 0;
  let zoomModule = null;
  let lastView = {};
  let lastPublished = '';
  let state = {
    status: 'loading', renderer: 'image', world: 'earth', scale: 'planet',
    band: 'planet', distanceMeters: null, cosmicTier: null,
    atlasReady: false, cosmologyReady: false, paused: false,
    message: 'Loading the current game atlas...'
  };
  const events = new AbortController();
  let canvasEvents = new AbortController();
  const publish = (patch = {}) => {
    if (disposed && patch.status !== 'disposed') return;
    state = {
      ...state, ...patch,
      atlasReady: (patch.renderer || state.renderer) === 'webgl' && canvas.dataset.planetHubCelestialAtlas === 'ready',
      cosmologyReady: (patch.renderer || state.renderer) === 'webgl' && canvas.dataset.planetHubCosmology === 'ready'
    };
    stage.dataset.status = state.status;
    stage.dataset.renderer = state.renderer;
    stage.dataset.scale = state.scale;
    stage.dataset.world = state.world;
    stage.dataset.paused = String(state.paused);
    notice.hidden = state.status === 'ready' && !state.message;
    notice.textContent = state.message;
    const signature = JSON.stringify(state);
    if (signature !== lastPublished) {
      lastPublished = signature;
      onState(Object.freeze({ ...state }));
    }
  };
  // A paused presentation still responds to deliberate navigation. Resume for
  // exactly one rendering opportunity, then suspend again before an idle loop
  // can continue. The public paused state remains true throughout this pulse.
  const refreshStillFrame = () => {
    if (!renderer || disposed || !manuallyPaused || !inViewport || documentRef.hidden || stillFrame) return;
    renderer.resume();
    stillFrame = windowRef.requestAnimationFrame(() => {
      stillFrame = 0;
      if (manuallyPaused || !inViewport || documentRef.hidden) renderer?.suspend();
    });
  };
  const cancelStillFrame = () => {
    if (stillFrame) windowRef.cancelAnimationFrame(stillFrame);
    stillFrame = 0;
  };
  const synchronizePause = () => {
    cancelStillFrame();
    const paused = manuallyPaused || !inViewport || documentRef.hidden;
    if (paused) renderer?.suspend();
    else renderer?.resume();
    publish({ paused });
  };
  const fallback = (message) => {
    cancelStillFrame();
    renderer?.destroy();
    renderer = null;
    canvas.style.opacity = '0';
    canvas.tabIndex = -1;
    poster.hidden = false;
    poster.src = publicUrl(`./art/planet-hub/posters/${state.world}-forge.webp`);
    poster.alt = `${state.world === 'moon' ? 'Moon' : 'Earth'} and the Forge, artwork from the current game`;
    publish({ status: 'fallback', renderer: 'image', scale: 'planet', band: 'planet', distanceMeters: null, cosmicTier: null, message });
  };
  const applyView = (view) => {
    lastView = view || lastView;
    const cosmicPending = state.scale === 'beyond' && canvas.dataset.planetHubCosmology !== 'ready';
    publish({
      band: lastView.band || 'planet',
      // Reporting only rounded distance avoids excessive DOM announcements
      // while the shared renderer animates continuously between scale stops.
      distanceMeters: Number.isFinite(lastView.distanceMeters) ? Number(lastView.distanceMeters.toPrecision(4)) : null,
      cosmicTier: lastView.cosmicTier || null,
      message: cosmicPending ? 'Loading the current deep-space layer...' : ''
    });
  };
  const loadResources = () => {
    if (!resourcesPromise) resourcesPromise = Promise.all([
      import(moduleUrl('./vendor/three/planet-hub-three.mjs?v=5.0.0-beta.4')),
      windowRef.fetch(publicUrl('./art/planet-hub/manifest.json')).then(async (response) => {
        if (!response.ok) throw new Error(`Atlas manifest request failed (${response.status}).`);
        return response.json();
      })
    ]);
    return resourcesPromise;
  };
  const ensureWorld = (id) => {
    if (disposed) return Promise.resolve(false);
    if (requestedWorld === id && worldPromise) return worldPromise;
    if (renderer && rendererWorld === id && !worldPromise) return Promise.resolve(true);
    requestedWorld = id;
    const request = ++worldGeneration;
    // Serialize construction on this canvas: a superseded renderer finishes
    // and disposes before its replacement can claim the WebGL context.
    const task = worldQueue.catch(() => {}).then(async () => {
      if (disposed || request !== worldGeneration) return false;
      try {
        const [modules, manifest] = await loadResources();
        if (disposed || request !== worldGeneration) return false;
        cancelStillFrame();
        renderer?.destroy();
        renderer = null;
        rendererWorld = null;
        // Shared renderer cleanup intentionally loses its graphics context.
        // A fresh canvas gives the next world an independent live context.
        canvasEvents.abort();
        canvasEvents = new AbortController();
        pointer = null;
        const nextCanvas = canvas.cloneNode(false);
        canvas.replaceWith(nextCanvas);
        canvas = nextCanvas;
        bindCanvasEvents();
        readinessObserver?.disconnect();
        readinessObserver?.observe(canvas, { attributes: true, attributeFilter: ['data-planet-hub-cosmology', 'data-planet-hub-celestial-atlas'] });
        for (const key of Object.keys(canvas.dataset)) {
          if (key.startsWith('planetHub')) delete canvas.dataset[key];
        }
        poster.src = publicUrl(`./art/planet-hub/posters/${id}-forge.webp`);
        poster.alt = `${id === 'moon' ? 'Moon' : 'Earth'} and the Forge, artwork from the current game`;
        poster.hidden = false;
        canvas.style.opacity = '0';
        publish({ world: id, scale: 'planet', status: 'loading', renderer: 'image', message: 'Loading the current game atlas...' });
        zoomModule = sharedZoom;
        const nextRenderer = await createThreePlanetHubRenderer({
          canvas, manifest, worldId: id,
          quality: quality === 'low' ? 'low' : 'standard',
          modules: { THREE: modules, GLTFLoader: modules.GLTFLoader },
          assetBaseUrl: publicUrl('./'), documentRef, windowRef, reducedMotion,
          effectsLevel: reducedMotion ? 'reduced' : 'full',
          onViewChange: (view) => { if (!disposed && request === worldGeneration) applyView(view); }
        });
        if (disposed || request !== worldGeneration) {
          nextRenderer.destroy();
          return false;
        }
        renderer = nextRenderer;
        rendererWorld = id;
        if (canvas.dataset.planetHubCelestialAtlas !== 'ready') {
          fallback('Current game artwork. The complete live atlas could not load.');
          return false;
        }
        canvas.style.opacity = '1';
        canvas.tabIndex = 0;
        poster.hidden = true;
        publish({ status: 'ready', renderer: 'webgl', message: '' });
        applyView(renderer.getViewZoom());
        synchronizePause();
        refreshStillFrame();
        return true;
      } catch (error) {
        if (disposed || request !== worldGeneration) return false;
        fallback('Current game artwork. Live 3D is unavailable in this browser.');
        stage.dataset.error = String(error?.message || error).slice(0, 180);
        return false;
      }
    });
    worldQueue = task;
    worldPromise = task.finally(() => { if (request === worldGeneration) worldPromise = null; });
    return worldPromise;
  };
  const setScale = async (id) => {
    if (disposed || !WEBSITE_ATLAS_SCALES.some((scale) => scale.id === id)) return false;
    if (state.status === 'fallback') return false;
    const operation = ++operationGeneration;
    if (!await ensureWorld('earth') || disposed || operation !== operationGeneration) return false;
    if (!renderer || !zoomModule) return false;
    if (!state.atlasReady && id !== 'planet' && id !== 'orbit') return false;
    // Named website stops are immediate compositions; free orbit still uses
    // the game's real camera. This also respects reduced-motion preferences.
    renderer.clearPointerOrbit?.();
    renderer.setOrbitBody('earth', { animate: false, source: 'website-scale' });
    const progress = {
      planet: zoomModule.PLANET_HUB_ZOOM_ANCHOR_PROGRESS.planet,
      orbit: zoomModule.PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit,
      system: zoomModule.PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system,
      stars: zoomModule.PLANET_HUB_ZOOM_ANCHOR_PROGRESS.galaxy,
      'milky-way': zoomModule.PLANET_HUB_ZOOM_ANCHOR_PROGRESS.universe
    };
    publish({ scale: id, world: 'earth' });
    if (id === 'beyond') {
      renderer.setCosmicZoom(zoomModule.planetHubCosmicZoomDistanceToProgress(
        zoomModule.PLANET_HUB_COSMIC_DISTANCE_STOPS.cosmicWeb * 0.5
      ), { immediate: true, source: 'website-scale' });
    } else {
      renderer.setCosmicZoom(0, { immediate: true, source: 'website-scale' });
      renderer.setViewZoom(progress[id], { immediate: true, source: 'website-scale' });
    }
    applyView(renderer.getViewZoom());
    refreshStillFrame();
    return true;
  };
  const setWorld = async (id) => {
    if (disposed || !['earth', 'moon'].includes(id)) return false;
    const operation = ++operationGeneration;
    if (state.status === 'fallback' && !renderer) {
      publish({ world: id, scale: 'planet' });
      fallback('Current game artwork. Live 3D is unavailable in this browser.');
      return true;
    }
    if (!await ensureWorld(id) || disposed || operation !== operationGeneration) return false;
    renderer.clearPointerOrbit?.();
    renderer.setCosmicZoom(0, { immediate: true, source: 'website-world' });
    renderer.setViewZoom(0, { immediate: true, source: 'website-world' });
    renderer.setOrbitBody(id, { animate: false, source: 'website-world' });
    publish({ world: id, scale: 'planet' });
    applyView(renderer.getViewZoom());
    refreshStillFrame();
    return true;
  };
  const onPointerEnd = (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    renderer?.releasePointerDrag({ cancelled: true });
    pointer = null;
    canvas.style.cursor = 'grab';
    refreshStillFrame();
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  function bindCanvasEvents() {
  canvas.addEventListener('pointerdown', (event) => {
    if (!renderer || event.button !== 0 || !inViewport || documentRef.hidden) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }, { signal: canvasEvents.signal });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    renderer?.setPointerDrag({ deltaX: event.clientX - pointer.x, deltaY: event.clientY - pointer.y, deltaMs: Math.max(1, event.timeStamp - pointer.at) });
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp };
    refreshStillFrame();
  }, { signal: canvasEvents.signal });
  canvas.addEventListener('pointerup', onPointerEnd, { signal: canvasEvents.signal });
  canvas.addEventListener('pointercancel', onPointerEnd, { signal: canvasEvents.signal });
  canvas.addEventListener('keydown', (event) => {
    if (!renderer || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    renderer.setPointerDrag({ deltaX: event.key === 'ArrowLeft' ? -24 : event.key === 'ArrowRight' ? 24 : 0, deltaY: event.key === 'ArrowUp' ? -24 : event.key === 'ArrowDown' ? 24 : 0, deltaMs: 40 });
    renderer.releasePointerDrag({ cancelled: true });
    refreshStillFrame();
  }, { signal: canvasEvents.signal });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    fallback('Current game artwork. The live 3D preview lost its graphics context.');
  }, { signal: canvasEvents.signal });
  }
  bindCanvasEvents();
  documentRef.addEventListener('visibilitychange', synchronizePause, { signal: events.signal });
  const observer = typeof windowRef.IntersectionObserver === 'function'
    ? new windowRef.IntersectionObserver((entries) => {
      inViewport = entries[0]?.isIntersecting !== false;
      synchronizePause();
    }, { rootMargin: '120px' }) : null;
  observer?.observe(stage);
  // Lazy atlas layers and layout changes also need a fresh still composition.
  const readinessObserver = typeof windowRef.MutationObserver === 'function'
    ? new windowRef.MutationObserver(refreshStillFrame) : null;
  readinessObserver?.observe(canvas, { attributes: true, attributeFilter: ['data-planet-hub-cosmology', 'data-planet-hub-celestial-atlas'] });
  const resizeObserver = typeof windowRef.ResizeObserver === 'function'
    ? new windowRef.ResizeObserver(refreshStillFrame) : null;
  resizeObserver?.observe(stage);
  publish();

  await ensureWorld('earth');

  return Object.freeze({
    setScale, setWorld,
    pause() { manuallyPaused = true; synchronizePause(); refreshStillFrame(); },
    resume() { manuallyPaused = false; synchronizePause(); },
    getState() { return Object.freeze({ ...state }); },
    dispose() {
      if (disposed) return;
      disposed = true;
      worldGeneration += 1;
      operationGeneration += 1;
      events.abort();
      canvasEvents.abort();
      cancelStillFrame();
      observer?.disconnect();
      readinessObserver?.disconnect();
      resizeObserver?.disconnect();
      renderer?.destroy();
      renderer = null;
      publish({ status: 'disposed', paused: true, message: '' });
      stage.remove();
    }
  });
}



