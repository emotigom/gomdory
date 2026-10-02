import assert from "node:assert/strict";
import test from "node:test";

import { createDecorateController } from "@/lib/edu/lesson/decorateController";

const createHarness = () => {
  let seq = 0;
  const skips: string[] = [];
  const clicks: string[] = [];
  const invariants: string[] = [];
  const lifecycle: string[] = [];

  const controller = createDecorateController({
    createRequestId: () => `req-${++seq}`,
    onSkip: ({ reason }) => skips.push(reason),
    onClick: ({ requestId }) => clicks.push(requestId),
    onInvariantViolation: ({ requestId }) => invariants.push(requestId),
    executeStart: async (_prompt, context) => {
      lifecycle.push(`start:${context.requestId}`);
      context.setPhase("server_kickoff");
      context.markServerPlanStart();
      return { ok: true as const, requestId: context.requestId, reason: "preview_ready" as const, mode: "llm" as const };
    },
    executeApplyPending: async (pending) => {
      lifecycle.push(`apply:${pending.requestId}`);
    },
    executeUndo: async () => {
      lifecycle.push("undo");
    },
  });

  return { controller, skips, clicks, invariants, lifecycle };
};

test("latest-wins: last decorate request remains effective", async () => {
  let resolver1: ((v: any) => void) | null = null;
  let resolver2: ((v: any) => void) | null = null;
  let seq = 0;
  const controller = createDecorateController({
    createRequestId: () => `req-${++seq}`,
    onSkip: () => {},
    onClick: () => {},
    onInvariantViolation: () => {},
    executeStart: (_prompt, context) =>
      new Promise((resolve) => {
        if (context.requestId === "req-1") resolver1 = resolve;
        else resolver2 = resolve;
      }),
    executeApplyPending: async () => {},
    executeUndo: async () => {},
  });

  const p1 = controller.startDecorate("a");
  const p2 = controller.startDecorate("b");
  resolver1?.({ ok: true, requestId: "req-1", reason: "preview_ready", mode: "llm" });
  resolver2?.({ ok: true, requestId: "req-2", reason: "preview_ready", mode: "llm" });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.ok, false);
  assert.equal(r2.ok, true);
  assert.equal(controller.getState().pending?.requestId, "req-2");
});

test("duplicate suppression: in-flight duplicate is skipped", async () => {
  let seq = 0;
  let holdResolve: ((v: any) => void) | null = null;
  const skips: string[] = [];
  const controller = createDecorateController({
    createRequestId: () => `req-${++seq}`,
    onSkip: ({ reason }) => skips.push(reason),
    onClick: () => {},
    onInvariantViolation: () => {},
    executeStart: async (_prompt, context) => {
      return await new Promise((resolve) => {
        holdResolve = resolve;
        setTimeout(() => resolve({ ok: true, requestId: context.requestId, reason: "preview_ready", mode: "llm" }), 50);
      });
    },
    executeApplyPending: async () => {},
    executeUndo: async () => {},
  });

  const p1 = controller.startDecorate("same");
  const p2 = controller.startDecorate("same");
  const r2 = await p2;
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, "in_flight_duplicate");
  assert.ok(skips.includes("in_flight_duplicate"));
  holdResolve?.({ ok: true, requestId: "req-1", reason: "preview_ready", mode: "llm" });
  await p1;
});

test("server start timeout helper can signal fallback kickoff", async () => {
  let seq = 0;
  const controller = createDecorateController({
    createRequestId: () => `req-${++seq}`,
    now: (() => {
      let now = 0;
      return () => (now += 1200);
    })(),
    onSkip: () => {},
    onClick: () => {},
    onInvariantViolation: () => {},
    executeStart: async (_prompt, context) => {
      assert.equal(context.shouldFallbackImmediately(), true);
      context.markServerPlanStart();
      return { ok: true, requestId: context.requestId, reason: "preview_ready", mode: "deterministic" };
    },
    executeApplyPending: async () => {},
    executeUndo: async () => {},
  });

  const result = await controller.startDecorate("fallback pls");
  assert.equal(result.ok, true);
});

test("server failure classified fallback can still return preview_ready", async () => {
  let seq = 0;
  const controller = createDecorateController({
    createRequestId: () => `req-${++seq}`,
    onSkip: () => {},
    onClick: () => {},
    onInvariantViolation: () => {},
    executeStart: async (_prompt, context) => {
      context.setPhase("server_kickoff");
      context.markServerPlanStart();
      return { ok: true, requestId: context.requestId, reason: "preview_ready", mode: "deterministic" };
    },
    executeApplyPending: async () => {},
    executeUndo: async () => {},
  });
  const result = await controller.startDecorate("timeout fallback");
  assert.equal(result.ok, true);
  assert.equal(result.mode, "deterministic");
});

test("preview_ready then applyPending enters stabilization before completed", async () => {
  const { controller, lifecycle } = createHarness();
  await controller.startDecorate("hello");
  await controller.applyPending();
  assert.ok(lifecycle.some((v) => v.startsWith("apply:req-1")));
  assert.equal(controller.getState().phase, "completed_stabilizing");
  await new Promise((resolve) => setTimeout(resolve, 1250));
  assert.equal(controller.getState().phase, "completed");
});

test("stale pending apply is blocked by executeApplyPending error", async () => {
  let seq = 0;
  const controller = createDecorateController({
    createRequestId: () => `req-${++seq}`,
    onSkip: () => {},
    onClick: () => {},
    onInvariantViolation: () => {},
    executeStart: async (_prompt, context) => {
      context.setPhase("server_kickoff");
      context.markServerPlanStart();
      return { ok: true, requestId: context.requestId, reason: "preview_ready", mode: "llm" };
    },
    executeApplyPending: async () => {
      throw new Error("blocked_stale_pending");
    },
    executeUndo: async () => {},
  });
  await controller.startDecorate("hello");
  await assert.rejects(() => controller.applyPending(), /blocked_stale_pending/);
});

test("newer decorate invalidates older pending", async () => {
  const { controller } = createHarness();
  await controller.startDecorate("first");
  const firstPending = controller.getState().pending?.requestId;
  await controller.startDecorate("second");
  const secondPending = controller.getState().pending?.requestId;
  assert.notEqual(firstPending, secondPending);
});

test("undo delegates to executeUndo", async () => {
  const { controller, lifecycle } = createHarness();
  await controller.undo();
  assert.ok(lifecycle.includes("undo"));
});

test("user_cancel abort cleanup allows next run", async () => {
  let seq = 0;
  const starts: string[] = [];
  const controller = createDecorateController({
    createRequestId: () => `req-${++seq}`,
    onSkip: () => {},
    onClick: () => {},
    onInvariantViolation: () => {},
    executeStart: async (_prompt, context) => {
      starts.push(context.requestId);
      if (context.requestId === "req-1") {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      context.markServerPlanStart();
      return { ok: true, requestId: context.requestId, reason: "preview_ready", mode: "llm" };
    },
    executeApplyPending: async () => {},
    executeUndo: async () => {},
  });

  const p1 = controller.startDecorate("first");
  const p2 = controller.startDecorate("second");
  await Promise.all([p1, p2]);
  assert.deepEqual(starts, ["req-1", "req-2"]);
});

test("invariant lifecycle emits once when server start marker missing", async () => {
  let seq = 0;
  const invariants: string[] = [];
  const controller = createDecorateController({
    createRequestId: () => `req-${++seq}`,
    onSkip: () => {},
    onClick: () => {},
    onInvariantViolation: ({ requestId }) => invariants.push(requestId),
    executeStart: async (_prompt, context) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return { ok: true, requestId: context.requestId, reason: "preview_ready", mode: "llm" };
    },
    executeApplyPending: async () => {},
    executeUndo: async () => {},
  });

  await controller.startDecorate("x");
  assert.equal(invariants.length, 1);
});


test("controller phase progression emits starting to server_kickoff to preview_ready", async () => {
  let seq = 0;
  const phases: string[] = [];
  const controller = createDecorateController({
    createRequestId: () => `req-${++seq}`,
    onSkip: () => {},
    onClick: () => {},
    onInvariantViolation: () => {},
    onPhaseTransition: ({ phase }) => phases.push(phase),
    executeStart: async (_prompt, context) => {
      context.setPhase("server_kickoff");
      context.markServerPlanStart();
      return { ok: true, requestId: context.requestId, reason: "preview_ready", mode: "llm" };
    },
    executeApplyPending: async () => {},
    executeUndo: async () => {},
  });

  await controller.startDecorate("phase check");
  assert.deepEqual(phases.slice(0, 3), ["starting", "server_kickoff", "preview_ready"]);
});


test("apply pending recheck can block stale preview handoff", async () => {
  let seq = 0;
  const controller = createDecorateController({
    createRequestId: () => `req-${++seq}`,
    onSkip: () => {},
    onClick: () => {},
    onInvariantViolation: () => {},
    executeStart: async (_prompt, context) => {
      context.markServerPlanStart();
      return { ok: true, requestId: context.requestId, reason: "preview_ready", mode: "llm" };
    },
    executeRecheckPending: async () => ({ eligible: false, reason: "blocked_stale_pending" }),
    executeApplyPending: async () => {
      throw new Error("must_not_apply");
    },
    executeUndo: async () => {},
  });
  await controller.startDecorate("hello");
  await controller.applyPending();
  assert.equal(controller.getState().phase, "blocked");
});
