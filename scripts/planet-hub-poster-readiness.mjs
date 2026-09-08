/** Build-only readiness: never block the interactive renderer's first frame. */
export function posterDetailUrls(manifest, { worldId, quality = 'standard', assetBaseUrl }) {
  const tier = manifest.optionalDetails?.tiers?.[quality];
  const world = tier?.[worldId];
  return [...new Set([
    ...['albedo', 'clouds', 'night', 'roughness', 'normal'].map(key => world?.[key]),
    tier?.sun?.emissive
  ].map(record => typeof record === 'string' ? record : record?.url)
    .filter(Boolean).map(url => new URL(url, assetBaseUrl).href))];
}

export function createPosterTextureTracker(TextureLoader) {
  const states = new Map();
  class PosterTextureLoader extends TextureLoader {
    async loadAsync(url, ...args) {
      const key = String(url);
      states.set(key, { status: 'loading' });
      try {
        const texture = await super.loadAsync(url, ...args);
        states.set(key, { status: 'loaded' });
        return texture;
      } catch (error) {
        states.set(key, { status: 'failed', error: String(error?.message || error) });
        throw error;
      }
    }
  }
  return { TextureLoader: PosterTextureLoader, states };
}

export async function waitForPosterDetails(states, urls, { timeoutMs = 20000, pollMs = 40 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const failed = urls.find(url => states.get(url)?.status === 'failed');
    if (failed) throw new Error(`Poster detail failed: ${failed} (${states.get(failed).error})`);
    const pending = urls.filter(url => states.get(url)?.status !== 'loaded');
    if (!pending.length) return Object.fromEntries(urls.map(url => [url, 'loaded']));
    if (Date.now() >= deadline) {
      throw new Error(`Poster detail timeout after ${timeoutMs}ms: ${pending.map(url => `${url} [${states.get(url)?.status || 'not-requested'}]`).join(', ')}`);
    }
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
}
