import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const routeRankClient = await readFile(new URL("../public/route-rank-client.mjs", import.meta.url), "utf8");

test("the client drives board art from permanent Route Rank", () => {
  assert.match(app, /createRankBoardArtRuntime/);
  const syncStart = app.indexOf("function syncRankBoardArt()");
  const syncEnd = app.indexOf("\nfunction ", syncStart + 20);
  const sync = app.slice(syncStart, syncEnd);
  assert.match(sync, /currentRouteRank\(\)/);
  assert.match(sync, /routeRank\?\.rank\?\.id/);
  assert.match(sync, /rankBoardArtRuntime\.setRank\(rankId\)/);
  assert.doesNotMatch(sync, /adaptiveDifficulty.*level/);
  assert.match(routeRankClient, /const nextSky = getRankBoardArtTier\(next[.]rank[.]id\)/);
  assert.match(routeRankClient, /previousSky[.]id === nextSky[.]id/);
});

test("starting words stay automatic without a result-screen selector", () => {
  const resultDialog = html.match(/<dialog\b(?=[^>]*id="resultDialog")[\s\S]*?<\/dialog>/)?.[0] || "";
  const homeModePicker = html.match(/<section\b(?=[^>]*id="modePicker")[\s\S]*?<\/section>/)?.[0] || "";
  assert.doesNotMatch(resultDialog, /role="radiogroup"|startStyleSummary|data-start-style|Same 4|New mix/);
  assert.doesNotMatch(homeModePicker, /data-start-style|start-style-control/);
  assert.match(resultDialog, /id="resultRetry"/);
  assert.match(app, /function nextStartStyleDecision\([\s\S]*preference:\s*"auto"/);
  assert.match(app, /startStyle:\s*"auto"/);
  assert.doesNotMatch(app, /startStylePreference|chooseStartStyle|data-start-style/);
});
