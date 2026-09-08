const HOME_PROJECT_ORIGIN = Object.freeze({ kind: "home", destination: "journey" });

/**
 * Lazy Home-shell adapter for the Moon project handoff. The 3D hub owns the
 * complete flight; this bridge keeps the black crossfade and project wiring
 * out of app.js until the Home rocket is prepared or activated.
 */
export function createMoonHomeProjectEntry({
  documentRef = globalThis.document,
  getController,
  audio = null,
  track = null,
  showFailure = null,
  loadLaunchModule = () => import("./moon-project-launch.mjs?v=5.0.0-beta.4")
} = {}) {
  if (typeof getController !== "function") {
    throw new TypeError("The Moon Home entry requires a project controller.");
  }

  let launchRuntimePromise = null;
  let activationPending = false;

  function ensureLaunchRuntime() {
    if (!launchRuntimePromise) {
      launchRuntimePromise = Promise.resolve()
        .then(() => loadLaunchModule())
        .then(({ createMoonProjectLaunch }) => createMoonProjectLaunch({
          documentRef,
          onCue: (cue, detail) => {
            if (cue === "blackout") {
              audio?.setScene?.("silent");
              audio?.prime?.({ startMusic: false });
            } else if (cue === "complete") {
              audio?.setScene?.("home");
              if (!documentRef.hidden) audio?.prime?.();
            }
            if (["launch", "handoff"].includes(cue)) {
              track?.("moon_project_flight", {
                phase: cue,
                kind: detail?.reason || getController().homeProject().surface
              });
            }
          }
        }))
        .catch((error) => {
          launchRuntimePromise = null;
          throw error;
        });
    }
    return launchRuntimePromise;
  }

  function prepare() {
    const actionKind = getController().homeProject().journey?.actionKind;
    if (!["launch", "continue"].includes(actionKind)) return Promise.resolve(null);
    return ensureLaunchRuntime()
      .then((runtime) => runtime.prepare())
      .catch(() => null);
  }

  async function activate(trigger = documentRef.querySelector("#moonHomeRocket")) {
    if (activationPending) return false;
    const controller = getController();
    const destination = controller.homeProject();
    const actionKind = destination.journey?.actionKind;
    let arrivalCommitted = false;
    activationPending = true;
    trigger?.setAttribute("aria-busy", "true");
    if (trigger) trigger.disabled = true;
    try {
      if (!["launch", "continue"].includes(actionKind)) {
        track?.("moon_project_preparation_opened", {
          origin: destination.journey?.origin?.id || "moon",
          destination: destination.journey?.destination?.id || "mars"
        });
        return await controller.openCurrentProject({ trigger, origin: HOME_PROJECT_ORIGIN });
      }
      const runtime = await ensureLaunchRuntime();
      return await runtime.play({
        trigger,
        label: destination.journey?.destination?.label || destination.title,
        open: ({ trigger: opener }) => {
          if (actionKind === "launch") {
            controller.recordArrival?.(destination.journey.destination.id);
            arrivalCommitted = true;
          }
          return controller.openCurrentProject({ trigger: opener, origin: HOME_PROJECT_ORIGIN });
        }
      });
    } catch (error) {
      audio?.setScene?.("home");
      if (actionKind === "launch" && !arrivalCommitted) {
        showFailure?.(error, "The Moon launch could not begin. Try again.");
        return false;
      }
      const opened = await controller.openCurrentProject({ trigger, origin: HOME_PROJECT_ORIGIN });
      if (!opened) showFailure?.(error, "The Moon project could not be opened.");
      return opened;
    } finally {
      activationPending = false;
      trigger?.removeAttribute("aria-busy");
      controller.syncEntryState();
    }
  }

  return Object.freeze({ prepare, activate, launch: activate });
}
