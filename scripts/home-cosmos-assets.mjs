import { assertResponsiveWebpAsset } from "./cosmic-gate-assets.mjs";

export const HOME_COSMOS_ASSETS = Object.freeze([
  Object.freeze({
    name: "home-cosmos-v1-md.webp",
    path: "art/home/home-cosmos-v1-md.webp",
    width: 1920,
    height: 1080,
    maximumBytes: 650_000
  }),
  Object.freeze({
    name: "home-cosmos-v1-lg.webp",
    path: "art/home/home-cosmos-v1-lg.webp",
    width: 3840,
    height: 2160,
    maximumBytes: 1_250_000
  }),
  Object.freeze({
    name: "home-cosmos-v1-portrait.webp",
    path: "art/home/home-cosmos-v1-portrait.webp",
    width: 1440,
    height: 2560,
    maximumBytes: 850_000
  })
]);

export function assertHomeCosmosAsset(buffer, asset, label = asset.path) {
  return assertResponsiveWebpAsset(buffer, asset, label);
}
