import assert from "node:assert/strict";
import test from "node:test";

import { createShareCardController } from "../public/share-card-runtime.mjs";

function fakeNode() {
  return {
    hidden: false,
    textContent: "",
    src: "",
    alt: "",
    querySelector() {
      return fakeNode();
    }
  };
}

function withShareDom(run) {
  const originalDocument = globalThis.document;
  const originalLocation = globalThis.location;
  const nodes = new Map([
    "#shareTarget",
    "#shareTitle",
    "#shareDescription",
    "#shareStats",
    "#shareCardPreview",
    "#copyChallenge",
    "#copyChallenge span",
    "#shareEyebrow"
  ].map((selector) => [selector, fakeNode()]));
  globalThis.document = {
    querySelector(selector) {
      const node = nodes.get(selector);
      if (!node) throw new Error(`Unexpected selector: ${selector}`);
      return node;
    }
  };
  globalThis.location = {
    origin: "https://example.test",
    pathname: "/play/"
  };
  try {
    return run(nodes);
  } finally {
    globalThis.document = originalDocument;
    globalThis.location = originalLocation;
  }
}

function controllerFor(state, getCosmeticCardStyle) {
  return createShareCardController({
    state,
    getTodayKey: () => "2026-07-27",
    stopTimer() {},
    showToast() {},
    track() {},
    async fetchJson() {},
    closeHubMenu() {},
    getCosmeticCardStyle
  });
}

test("share controller derives a sanitized card style at population time", () => {
  withShareDom((nodes) => {
    const state = {
      game: null,
      assist: "none",
      wished: false,
      scoringDisabled: false,
      history: [],
      newDiscoveries: 0,
      moves: 0
    };
    let style = "constellore.collection.aurora-archive";
    const controller = controllerFor(state, () => style);
    const game = {
      target: "Telescope",
      emoji: "T",
      seed: 42,
      mode: "challenge",
      clue: "Look farther.",
      category: "cosmic",
      universe: { name: "Clockwork Nebula", id: "clockwork-42" }
    };

    controller.populateShare(game, false);
    assert.equal(state.shareCard.cardStyle, "aurora-archive");
    assert.match(decodeURIComponent(nodes.get("#shareCardPreview").src), /data-card-style="aurora-archive"/);

    style = "constellore.collection.lunar-garden";
    controller.populateShare(game, false);
    assert.equal(state.shareCard.cardStyle, "lunar-garden");
    assert.match(decodeURIComponent(nodes.get("#shareCardPreview").src), /data-card-style="lunar-garden"/);

    style = "constellore.collection.eclipse-sovereign";
    controller.populateShare(game, false);
    assert.equal(state.shareCard.cardStyle, "eclipse-sovereign");
    assert.match(decodeURIComponent(nodes.get("#shareCardPreview").src), /data-card-style="eclipse-sovereign"/);

    for (const collection of ["pixel-frontier", "bubble-reef", "stellar-vanguard"]) {
      style = `constellore.collection.${collection}`;
      controller.populateShare(game, false);
      assert.equal(state.shareCard.cardStyle, collection);
      assert.match(
        decodeURIComponent(nodes.get("#shareCardPreview").src),
        new RegExp(`data-card-style="${collection}"`)
      );
    }

    style = "unknown-from-profile";
    controller.populateShare(game, false);
    assert.equal(state.shareCard.cardStyle, undefined);
    assert.doesNotMatch(decodeURIComponent(nodes.get("#shareCardPreview").src), /data-card-style=/);
  });
});

test("share controller falls back safely when the optional style callback throws", () => {
  withShareDom(() => {
    const state = {
      game: null,
      assist: "none",
      wished: false,
      scoringDisabled: false,
      history: [],
      newDiscoveries: 0,
      moves: 0
    };
    const controller = controllerFor(state, () => {
      throw new Error("profile unavailable");
    });
    controller.populateShare({
      target: "Moon",
      emoji: "M",
      seed: 7,
      mode: "challenge",
      category: "cosmic",
      universe: { name: "Deep Void", id: "deep-7" }
    });
    assert.equal(state.shareCard.cardStyle, undefined);
  });
});
