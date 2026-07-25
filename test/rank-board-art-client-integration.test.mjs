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

test("starting-word choices use one labelled radio group and roving focus", () => {
  const resultDialog = html.match(/<dialog\b(?=[^>]*id="resultDialog")[\s\S]*?<\/dialog>/)?.[0] || "";
  const homeModePicker = html.match(/<details\b(?=[^>]*id="modePicker")[\s\S]*?<\/details>/)?.[0] || "";
  assert.match(resultDialog, /role="radiogroup"[^>]+aria-describedby="startStyleSummary"/);
  assert.match(resultDialog, /data-start-style="auto">Auto</);
  assert.match(resultDialog, /data-start-style="classic">Same 4</);
  assert.match(resultDialog, /data-start-style="shuffled">New mix</);
  assert.doesNotMatch(homeModePicker, /data-start-style|start-style-control/);
  assert.match(app, /button\.tabIndex = selected \? 0 : -1/);
  assert.match(app, /New mixes unlock after Bronze/);
  assert.match(app, /bronzeLocked && preference === "shuffled"/);
});
