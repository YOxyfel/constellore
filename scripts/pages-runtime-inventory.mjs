// Prototype entries have no route in the public release. Keep their source locally.
export const PAGES_EXCLUDED_PROTOTYPE_FILES = Object.freeze([
  "word-node-lab.mjs",
  "word-node-chemistry.mjs",
  "word-node-bond-editor.mjs",
  "concept-bloom-lab.mjs",
  "concept-bloom-domain.mjs",
  "website-voyage-preview.mjs"
]);

// Apply the existing deterministic release transform without changing source modules.
export const PAGES_MINIFIED_CORE_RUNTIME_FILES = Object.freeze([
  "app.js",
  "local-beta.mjs",
  "molecular-memory.mjs",
  "cosmic-interlude-runtime.mjs",
  "home-menu-view.mjs",
  "word-bloom-input-runtime.mjs",
  "word-orbit-runtime.mjs",
  "moon-heart-project-presentation.mjs",
  "scramble.mjs"
]);
