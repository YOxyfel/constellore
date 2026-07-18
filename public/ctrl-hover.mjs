export function createCtrlHoverController({ getNode, combine, onChange = () => {} }) {
  let active = false;
  let anchorId = null;
  let queuedId = null;
  let pending = false;
  let sourceId = null;
  let targetId = null;
  let generation = 0;
  let operation = 0;

  const snapshot = () => ({ active, anchorId, queuedId, pending, sourceId, targetId });
  const emit = () => onChange(snapshot());
  const resolve = (id) => id == null ? null : getNode(id);

  function setActive(nextActive) {
    if (active === nextActive) return false;
    generation += 1;
    active = nextActive;
    anchorId = null;
    queuedId = null;
    sourceId = null;
    targetId = null;
    emit();
    return true;
  }

  function reset({ keepActive = false, abandonPending = false } = {}) {
    generation += 1;
    active = keepActive && active;
    anchorId = null;
    queuedId = null;
    sourceId = null;
    targetId = null;
    if (abandonPending) {
      operation += 1;
      pending = false;
    }
    emit();
  }

  function enter(id) {
    if (!active) return { type: "ignored" };
    const node = resolve(id);
    if (!node) return { type: "ignored" };

    if (pending) {
      if (id === sourceId || id === targetId || id === queuedId) return { type: "ignored" };
      queuedId = id;
      emit();
      return { type: "queued", node };
    }

    const anchor = resolve(anchorId);
    if (!anchor) {
      anchorId = id;
      queuedId = null;
      emit();
      return { type: "armed", node };
    }
    if (anchor.id === id) return { type: "ignored" };

    void run(anchor.id, node.id, generation);
    return { type: "combining", source: anchor, target: node };
  }

  async function run(nextSourceId, nextTargetId, runGeneration) {
    const source = resolve(nextSourceId);
    const target = resolve(nextTargetId);
    if (!active || pending || !source || !target || source.id === target.id) return;

    const runOperation = ++operation;
    pending = true;
    anchorId = null;
    queuedId = null;
    sourceId = source.id;
    targetId = target.id;
    emit();

    let outcome = null;
    try {
      outcome = await combine(source, target);
    } catch {
      outcome = null;
    }

    if (runOperation !== operation) return;
    pending = false;
    sourceId = null;
    targetId = null;

    if (runGeneration !== generation) {
      const waiting = active ? resolve(queuedId) : null;
      anchorId = waiting?.id ?? null;
      queuedId = null;
      emit();
      return;
    }

    if (!active || outcome?.completed) {
      anchorId = null;
      queuedId = null;
      emit();
      return;
    }

    const result = resolve(outcome?.node?.id);
    const fallback = resolve(target.id) || resolve(source.id);
    anchorId = result?.id ?? fallback?.id ?? null;
    const waiting = resolve(queuedId);
    queuedId = null;
    emit();

    if (anchorId != null && waiting && waiting.id !== anchorId) {
      queueMicrotask(() => {
        if (active && !pending && runGeneration === generation) void run(anchorId, waiting.id, runGeneration);
      });
    }
  }

  return { enter, reset, setActive, snapshot };
}
