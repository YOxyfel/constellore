import assert from 'node:assert/strict';
import test from 'node:test';
import { createPosterTextureTracker, posterDetailUrls, waitForPosterDetails } from '../scripts/planet-hub-poster-readiness.mjs';

test('poster capture waits for all declared progressive maps, not just the base renderer', async () => {
  const urls = posterDetailUrls({optionalDetails:{tiers:{standard:{earth:{albedo:{url:'./albedo.webp'},clouds:{url:'./clouds.webp'},night:{url:'./night.webp'}},sun:{emissive:{url:'./sun.webp'}}}}}}, {worldId:'earth',assetBaseUrl:'http://localhost/public/'});
  assert.deepEqual(urls, ['albedo','clouds','night','sun'].map(name=>`http://localhost/public/${name}.webp`));
  let resolveLoad;
  class Loader { loadAsync() { return new Promise(resolve=>{resolveLoad=resolve;}); } }
  const tracker=createPosterTextureTracker(Loader);
  const loader=new tracker.TextureLoader();
  const loading=loader.loadAsync(urls[0]);
  let finished=false;
  const ready=waitForPosterDetails(tracker.states,[urls[0]],{timeoutMs:1000,pollMs:1}).then(value=>{finished=true;return value;});
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(finished,false,'a resolved base renderer cannot capture during an outstanding albedo load');
  const texture={image:{width:4096}};
  resolveLoad(texture);
  assert.equal(await loading,texture);
  assert.deepEqual(await ready,{[urls[0]]:'loaded'});
});

test('poster texture failures and missing requests stop capture with actionable errors', async () => {
  class Loader { async loadAsync() { throw new Error('decode failed'); } }
  const tracker=createPosterTextureTracker(Loader);
  await assert.rejects(new tracker.TextureLoader().loadAsync('/clouds.webp'),/decode failed/);
  await assert.rejects(waitForPosterDetails(tracker.states,['/clouds.webp']),/Poster detail failed: \/clouds.webp \(decode failed\)/);
  await assert.rejects(waitForPosterDetails(new Map(),['/albedo.webp'],{timeoutMs:5,pollMs:1}),/Poster detail timeout.*albedo.webp \[not-requested\]/);
  assert.deepEqual(await waitForPosterDetails(new Map(),[]),{});
});
