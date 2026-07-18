import assert from "node:assert/strict";
import test from "node:test";

import { createCtrlHoverController } from "../public/ctrl-hover.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, reject, resolve };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup(combine) {
  const nodes = new Map(["A", "B", "C", "D"].map((id) => [id, { id }]));
  const changes = [];
  const controller = createCtrlHoverController({
    getNode: (id) => nodes.get(id) || null,
    combine,
    onChange: (state) => changes.push(state)
  });
  return { changes, controller, nodes };
}

test("Ctrl hover arms once and combines a distinct second word", async () => {
  const pending = deferred();
  const calls = [];
  const { controller } = setup((a, b) => {
    calls.push([a.id, b.id]);
    return pending.promise;
  });

  assert.equal(controller.enter("A").type, "ignored");
  controller.setActive(true);
  assert.equal(controller.enter("A").type, "armed");
  assert.equal(controller.enter("A").type, "ignored");
  assert.equal(controller.enter("B").type, "combining");
  assert.deepEqual(calls, [["A", "B"]]);

  controller.setActive(false);
  pending.resolve(null);
  await tick();
  assert.equal(controller.snapshot().anchorId, null);
});

test("fast sweeps serialize combinations and keep only the latest hovered word", async () => {
  const first = deferred();
  const second = deferred();
  const calls = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const { controller, nodes } = setup(async (a, b) => {
    calls.push([a.id, b.id]);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const outcome = await (calls.length === 1 ? first.promise : second.promise);
    inFlight -= 1;
    return outcome;
  });

  controller.setActive(true);
  controller.enter("A");
  controller.enter("B");
  assert.equal(controller.enter("C").type, "queued");
  assert.equal(controller.enter("D").type, "queued");
  assert.deepEqual(calls, [["A", "B"]]);

  nodes.delete("A");
  nodes.delete("B");
  nodes.set("R", { id: "R" });
  first.resolve({ node: nodes.get("R"), completed: false });
  await tick();
  assert.deepEqual(calls, [["A", "B"], ["R", "D"]]);
  assert.equal(maxInFlight, 1);

  nodes.delete("R");
  nodes.delete("D");
  nodes.set("S", { id: "S" });
  second.resolve({ node: nodes.get("S"), completed: false });
  await tick();
  assert.equal(controller.snapshot().anchorId, "S");
  assert.equal(maxInFlight, 1);
});

test("releasing Ctrl cancels queued chaining without cancelling the accepted mix", async () => {
  const pending = deferred();
  const calls = [];
  const { controller, nodes } = setup((a, b) => {
    calls.push([a.id, b.id]);
    return pending.promise;
  });

  controller.setActive(true);
  controller.enter("A");
  controller.enter("B");
  controller.enter("C");
  controller.setActive(false);
  nodes.delete("A");
  nodes.delete("B");
  nodes.set("R", { id: "R" });
  pending.resolve({ node: nodes.get("R"), completed: false });
  await tick();

  assert.deepEqual(calls, [["A", "B"]]);
  assert.deepEqual(controller.snapshot(), {
    active: false,
    anchorId: null,
    queuedId: null,
    pending: false,
    sourceId: null,
    targetId: null
  });
});

test("a rejected mix remembers the last hovered surviving word", async () => {
  const pending = deferred();
  const { controller } = setup(() => pending.promise);

  controller.setActive(true);
  controller.enter("A");
  controller.enter("B");
  pending.resolve(null);
  await tick();

  assert.equal(controller.snapshot().anchorId, "B");
});

test("a winning result never starts a queued combination", async () => {
  const pending = deferred();
  const calls = [];
  const { controller, nodes } = setup((a, b) => {
    calls.push([a.id, b.id]);
    return pending.promise;
  });

  controller.setActive(true);
  controller.enter("A");
  controller.enter("B");
  controller.enter("C");
  nodes.delete("A");
  nodes.delete("B");
  nodes.set("WIN", { id: "WIN" });
  pending.resolve({ node: nodes.get("WIN"), completed: true });
  await tick();

  assert.deepEqual(calls, [["A", "B"]]);
  assert.equal(controller.snapshot().anchorId, null);
  assert.equal(controller.snapshot().queuedId, null);
});

test("hard reset invalidates late controller callbacks from an old orbit", async () => {
  const oldMix = deferred();
  const newMix = deferred();
  const calls = [];
  const { controller, nodes } = setup((a, b) => {
    calls.push([a.id, b.id]);
    return calls.length === 1 ? oldMix.promise : newMix.promise;
  });

  controller.setActive(true);
  controller.enter("A");
  controller.enter("B");
  controller.reset({ abandonPending: true });
  controller.setActive(true);
  controller.enter("C");
  controller.enter("D");
  assert.deepEqual(calls, [["A", "B"], ["C", "D"]]);

  nodes.set("OLD", { id: "OLD" });
  oldMix.resolve({ node: nodes.get("OLD"), completed: false });
  await tick();
  assert.equal(controller.snapshot().pending, true);

  nodes.delete("C");
  nodes.delete("D");
  nodes.set("NEW", { id: "NEW" });
  newMix.resolve({ node: nodes.get("NEW"), completed: false });
  await tick();
  assert.equal(controller.snapshot().anchorId, "NEW");
});
