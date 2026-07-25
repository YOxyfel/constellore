import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RANK_BOARD_ART_PRELOAD_ATTRIBUTE,
  applyRankBoardArt,
  createRankBoardArtRuntime
} from "../public/rank-board-art-runtime.mjs";

class FakeStyle {
  values = new Map();

  setProperty(name, value) {
    this.values.set(name, value);
  }

  getPropertyValue(name) {
    return this.values.get(name) || "";
  }
}

class FakeLink {
  attributes = new Map();
  parent = null;

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  remove() {
    if (this.parent) {
      this.parent.links = this.parent.links.filter((link) => link !== this);
    }
  }
}

class FakeEventTarget {
  listeners = new Map();

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) || new Set();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.listeners.get(name)?.delete(listener);
  }

  dispatch(name) {
    for (const listener of this.listeners.get(name) || []) listener();
  }
}

function fakeDom({ width = 900, saveData = false } = {}) {
  const connection = Object.assign(new FakeEventTarget(), { saveData });
  const reducedDataMedia = Object.assign(new FakeEventTarget(), { matches: false });
  const view = Object.assign(new FakeEventTarget(), {
    innerWidth: width,
    navigator: { connection },
    matchMedia(query) {
      assert.equal(query, "(prefers-reduced-data: reduce)");
      return reducedDataMedia;
    },
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    cancelAnimationFrame() {}
  });
  const head = {
    links: [],
    append(link) {
      link.parent = this;
      this.links.push(link);
    }
  };
  const document = {
    nodeType: 9,
    defaultView: view,
    head,
    createElement(name) {
      assert.equal(name, "link");
      return new FakeLink();
    },
    querySelector(selector) {
      if (!selector.includes(RANK_BOARD_ART_PRELOAD_ATTRIBUTE)) return null;
      return head.links[0] || null;
    }
  };
  const attributes = new Map();
  const root = {
    nodeType: 1,
    clientWidth: width,
    ownerDocument: document,
    style: new FakeStyle(),
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.get(name) || null;
    }
  };
  document.documentElement = root;
  return { connection, document, head, reducedDataMedia, root, view };
}

test("one application sets trusted variables, state attributes, and one preload", () => {
  const dom = fakeDom({ width: 390 });
  const presentation = applyRankBoardArt(dom.root, "Cosmic");
  assert.equal(presentation.variant.id, "sm");
  assert.equal(
    dom.root.style.getPropertyValue("--rank-board-image"),
    'url("./art/ranks/tier-06-singularity-sm.webp")'
  );
  assert.equal(dom.root.getAttribute("data-rank-board-art-rank"), "cosmic");
  assert.equal(dom.root.getAttribute("data-rank-board-art-tier"), "singularity");
  assert.equal(dom.root.getAttribute("data-rank-board-art-quality"), "sm");
  assert.equal(dom.head.links.length, 1);
  assert.equal(
    dom.head.links[0].getAttribute("href"),
    "./art/ranks/tier-06-singularity-sm.webp"
  );
  assert.match(
    dom.head.links[0].getAttribute("imagesrcset"),
    /tier-06-singularity-md\.webp 896w/
  );

  applyRankBoardArt(dom.root, "Gold");
  assert.equal(dom.head.links.length, 1, "the managed preload must be reused");
  assert.equal(
    dom.head.links[0].getAttribute("href"),
    "./art/ranks/tier-02-dawn-sm.webp"
  );
});

test("Document roots work and Save-Data removes only the managed bitmap preload", () => {
  const dom = fakeDom({ width: 900, saveData: true });
  const presentation = applyRankBoardArt(dom.document, "ruby");
  assert.equal(presentation.reducedData, true);
  assert.equal(dom.root.style.getPropertyValue("--rank-board-image"), "none");
  assert.equal(dom.root.getAttribute("data-rank-board-art-quality"), "fallback");
  assert.equal(dom.head.links.length, 0);
  assert.throws(
    () => applyRankBoardArt({}, "ruby"),
    /Document or style-capable Element/
  );
});

test("mounted runtime responds to resize, rank, and data-saver changes", () => {
  const dom = fakeDom({ width: 900 });
  const runtime = createRankBoardArtRuntime({
    target: dom.root,
    rank: "silver",
    ResizeObserver: null
  });
  assert.equal(runtime.presentation.rank.id, "silver");
  assert.equal(runtime.presentation.variant.id, "md");
  assert.equal(dom.view.listeners.get("resize")?.size, 1);
  assert.equal(dom.connection.listeners.get("change")?.size, 1);
  assert.equal(dom.reducedDataMedia.listeners.get("change")?.size, 1);

  dom.root.clientWidth = 390;
  dom.view.dispatch("resize");
  assert.equal(runtime.presentation.variant.id, "sm");

  runtime.setRank("legend");
  assert.equal(runtime.presentation.rank.id, "legend");
  assert.equal(runtime.presentation.tier.id, "singularity");

  dom.connection.saveData = true;
  dom.connection.dispatch("change");
  assert.equal(runtime.presentation.reducedData, true);
  assert.equal(dom.head.links.length, 0);

  runtime.setReducedData(false);
  assert.equal(runtime.presentation.reducedData, false);
  assert.equal(dom.head.links.length, 1);

  runtime.setReducedData(undefined);
  dom.connection.saveData = false;
  dom.reducedDataMedia.matches = true;
  dom.reducedDataMedia.dispatch("change");
  assert.equal(runtime.presentation.reducedData, true);
  assert.equal(dom.head.links.length, 0);

  runtime.destroy();
  assert.equal(dom.view.listeners.get("resize")?.size, 0);
  assert.equal(dom.connection.listeners.get("change")?.size, 0);
  assert.equal(dom.reducedDataMedia.listeners.get("change")?.size, 0);
  assert.equal(dom.head.links.length, 0);
});

test("rank board CSS layers art beneath readable words with accessibility fallbacks", async () => {
  const css = await readFile(
    new URL("../public/simple-ui.css", import.meta.url),
    "utf8"
  );
  const blockStart = css.indexOf("/* Rank board art:");
  assert.ok(blockStart > 0);
  const block = css.slice(blockStart);
  assert.match(block, /var\(--rank-board-image, none\)/);
  assert.match(block, /var\(--rank-board-overlay, \.72\)/);
  assert.match(block, /var\(--rank-board-focal, 50% 44%\)/);
  assert.match(block, /\.cosmos-board \.board-word/);
  assert.match(block, /@media \(prefers-reduced-data: reduce\)/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(block, /@media \(prefers-contrast: more\)/);
  assert.match(block, /@media \(forced-colors: active\)/);
});
