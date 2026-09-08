import { createConceptReactionHistory } from "./concept-chemistry.mjs?v=5.0.0-beta.4";
import { createMolecularMemoryPresentation } from "./molecular-memory.mjs?v=5.0.0-beta.4";

function wordKey(value) {
  return String(value?.word ?? value ?? "").trim().toLocaleLowerCase("en-US");
}

export function createMolecularMemoryRuntime({
  document,
  boardItems,
  onExpanded
} = {}) {
  if (!document || !boardItems) throw new TypeError("Molecular Memory runtime requires a document and board item host.");
  const records = new Map();

  function destroy(id) {
    const key = String(id);
    const record = records.get(key);
    if (!record) return false;
    record.controller.destroy();
    records.delete(key);
    return true;
  }

  function clear() {
    for (const id of [...records.keys()]) destroy(id);
  }

  function close(exceptId = "") {
    const excluded = String(exceptId || "");
    for (const [id, record] of records) {
      if (id !== excluded) record.controller.setExpanded(false);
    }
  }

  function latestInstance(word, rawHistory = []) {
    const key = wordKey(word);
    if (!key) return "";
    const event = [...createConceptReactionHistory(rawHistory).events]
      .reverse()
      .find((candidate) => candidate.output.key === key);
    return event?.output.instanceId || `origin:${key}`;
  }

  function instanceFor(node, rawHistory = []) {
    return String(node?.molecularMemoryInstanceId || "").trim()
      || latestInstance(node?.item?.word, rawHistory);
  }

  function prune(liveIds) {
    for (const id of [...records.keys()]) {
      if (!liveIds.has(id)) destroy(id);
    }
  }

  function sync({ nodes = [], history = [], active = true } = {}) {
    const playable = nodes.filter((node) => !node.revealRole && !node.item?.ghost);
    const liveIds = new Set(playable.map((node) => String(node.id)));
    prune(liveIds);
    if (!active) return;
    const reactionHistory = createConceptReactionHistory(history);
    for (const node of playable) {
      const id = String(node.id);
      const host = boardItems.querySelector(`.board-word[data-id="${CSS.escape(id)}"]`);
      if (!host) continue;
      const previous = records.get(id);
      const word = node.item.word;
      const instanceId = instanceFor(node, history);
      if (!node.molecularMemoryInstanceId) node.molecularMemoryInstanceId = instanceId;
      if (previous?.host !== host || !host.contains(previous?.controller.root)) {
        previous?.controller.destroy();
        const controller = createMolecularMemoryPresentation({
          document,
          id: `molecular-memory-node-${id}`,
          word,
          instanceId,
          history: reactionHistory,
          onExpandedChange: ({ expanded }) => {
            if (!expanded) return;
            close(id);
            onExpanded?.({ id, node, host });
          }
        }).attach(host, { panelContainer: document.body });
        records.set(id, { controller, host, word, instanceId, historyLength: history.length });
      } else if (previous.word !== word || previous.instanceId !== instanceId || previous.historyLength !== history.length) {
        previous.controller.update({ word, instanceId, history: reactionHistory });
        Object.assign(previous, { word, instanceId, historyLength: history.length });
      }
    }
  }

  return Object.freeze({
    sync,
    clear,
    close,
    destroy,
    latestInstance,
    instanceFor,
    has: (id) => records.has(String(id)),
    collapse: (id) => records.get(String(id))?.controller.setExpanded(false),
    get size() { return records.size; }
  });
}
