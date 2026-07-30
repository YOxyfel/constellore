import { buildGoldenPairAnimation } from "./golden-pair-animations.mjs?v=5.0.0-beta.1";
import { createGoldenPairView } from "./golden-pair-view.mjs?v=5.0.0-beta.1";

const STYLE_MARKER = "data-golden-pair-style";
const HOST_MARKER = "data-golden-pair-runtime-root";
const BOARD_RUNTIMES = new WeakMap();

function frozenResult(played, reason, extra = {}) {
  return Object.freeze({ played, reason, ...extra });
}

function removeOwnedHost(host) {
  if (!host) return;
  if (typeof host.remove === "function") {
    host.remove();
    return;
  }
  if (typeof host.parentNode?.removeChild === "function") host.parentNode.removeChild(host);
}

function createUnavailableRuntime(reason, cleanup = () => {}) {
  let disposed = false;
  return Object.freeze({
    available: false,
    play() {
      return frozenResult(false, reason);
    },
    cancel() {
      return Object.freeze({ cancelled: false, reason });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cleanup();
    }
  });
}

function loadStyles(documentRef) {
  if (documentRef.querySelector?.(`[${STYLE_MARKER}]`)) return Promise.resolve();
  const link = documentRef.createElement("link");
  const moduleUrl = new URL(import.meta.url);
  const styleUrl = new URL("./golden-pair.css?v=5.0.0-beta.1", moduleUrl);
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

/**
 * Lazily loads the Golden Pair presentation layer and returns a safe facade.
 *
 * Factory setup is asynchronous because the stylesheet is lazy. After setup,
 * `play`, `cancel`, and `dispose` are all synchronous and never throw into the
 * gameplay path.
 */
async function initializeGoldenPairRuntime({
  root,
  board,
  timers,
  reducedMotion
} = {}, registeredBoard = null) {
  const documentRef = root?.ownerDocument || board?.ownerDocument;
  let host = root;
  let ownsHost = false;
  const releaseRegistration = () => {
    if (registeredBoard) BOARD_RUNTIMES.delete(registeredBoard);
  };

  if (
    !documentRef?.head
    || typeof documentRef.createElement !== "function"
  ) {
    releaseRegistration();
    return createUnavailableRuntime("missing-root");
  }

  if (!host) {
    if (
      !board
      || typeof board.append !== "function"
      || typeof board.setAttribute !== "function"
    ) {
      releaseRegistration();
      return createUnavailableRuntime("missing-root");
    }
    host = documentRef.createElement("div");
    host.setAttribute(HOST_MARKER, "");
    board.append(host);
    ownsHost = true;
  }

  if (typeof host.replaceChildren !== "function") {
    if (ownsHost) removeOwnedHost(host);
    releaseRegistration();
    return createUnavailableRuntime("missing-root");
  }

  try {
    await loadStyles(documentRef);
  } catch {
    // Styling failure must never block or alter a valid combination.
  }

  let view;
  try {
    view = createGoldenPairView({
      root: host,
      timers,
      reducedMotion: reducedMotion ?? (() => (
        documentRef.defaultView
          ?.matchMedia?.("(prefers-reduced-motion: reduce)")
          ?.matches ?? true
      ))
    });
  } catch {
    if (ownsHost) removeOwnedHost(host);
    releaseRegistration();
    return createUnavailableRuntime("view-unavailable");
  }

  let disposed = false;
  return Object.freeze({
    available: true,
    play(options = {}) {
      if (disposed) return frozenResult(false, "disposed");
      if (documentRef.body?.dataset?.cosmeticEffects === "off") {
        try {
          view.cancel("effects-off");
        } catch {
          // Effects Off is still honored when visual teardown is unavailable.
        }
        return frozenResult(false, "effects-off");
      }
      try {
        const model = buildGoldenPairAnimation({
          a: options?.a,
          b: options?.b,
          result: options?.result
        });
        if (!model) {
          view.cancel("not-authored");
          return frozenResult(false, "not-authored");
        }
        return view.play(model);
      } catch {
        try {
          view.cancel("runtime-error");
        } catch {
          // A failed optional effect cannot affect the valid combination.
        }
        return frozenResult(false, "runtime-error");
      }
    },
    cancel(reason = "cancelled") {
      if (disposed) return Object.freeze({ cancelled: false, reason: "disposed" });
      try {
        return view.cancel(reason);
      } catch {
        return Object.freeze({ cancelled: false, reason: "runtime-error" });
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        view.dispose();
      } catch {
        // Teardown is best-effort and must not destabilize the game shell.
      }
      if (ownsHost) removeOwnedHost(host);
      releaseRegistration();
    }
  });
}

export function createGoldenPairRuntime(options = {}) {
  const board = options?.root ? null : options?.board;
  if (!board || (typeof board !== "object" && typeof board !== "function")) {
    return initializeGoldenPairRuntime(options);
  }

  const existing = BOARD_RUNTIMES.get(board);
  if (existing) return existing;

  const pending = initializeGoldenPairRuntime(options, board);
  BOARD_RUNTIMES.set(board, pending);
  pending.then((runtime) => {
    if (!runtime.available && BOARD_RUNTIMES.get(board) === pending) {
      BOARD_RUNTIMES.delete(board);
    }
  });
  return pending;
}
