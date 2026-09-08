import { buildCombinationStory } from "./combination-story.mjs?v=5.0.0-beta.4";
import { createCombinationStoryView } from "./combination-story-view.mjs?v=5.0.0-beta.4";

const STYLE_MARKER = "data-combination-story-style";

function loadStyles(documentRef) {
  if (documentRef.querySelector?.(`[${STYLE_MARKER}]`)) return Promise.resolve();
  const link = documentRef.createElement("link");
  const moduleUrl = new URL(import.meta.url);
  const styleUrl = new URL("./combination-story.css?v=5.0.0-beta.4", moduleUrl);
  styleUrl.search = moduleUrl.search;
  link.rel = "stylesheet";
  link.href = styleUrl.href;
  link.setAttribute(STYLE_MARKER, "");
  return new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    documentRef.head.append(link);
  });
}

export async function createCombinationStoryRuntime({ root } = {}) {
  const documentRef = root?.ownerDocument;
  if (!documentRef?.head) throw new TypeError("Combination story runtime requires a document-backed root.");
  await loadStyles(documentRef);
  const view = createCombinationStoryView({
    root,
    reducedMotion: () => documentRef.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? true
  });
  return Object.freeze({
    render(options = {}) {
      view.render(buildCombinationStory(options));
    },
    reset() {
      view.reset();
    },
    dispose() {
      view.dispose();
    }
  });
}
