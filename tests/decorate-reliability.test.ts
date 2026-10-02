import assert from "node:assert/strict";
import test from "node:test";

import { createDecorateController } from "@/lib/edu/lesson/decorateController";
import { decideDecorateDegradedMode } from "@/lib/edu/lesson/decorateDegradedMode";
import { runDecorateReliabilityPrewarm } from "@/lib/edu/lesson/decorateReliabilityPrewarm";

test("decorate degraded mode escalates under network/sla pressure", () => {
  const decision = decideDecorateDegradedMode({
    kickoffDelayMs: 1200,
    snapshotReady: false,
    hydrationStable: false,
    recentSlaBreach: true,
  });
  assert.equal(decision.mode, "degraded_strict");
  assert.equal(decision.forceDeterministicFallback, true);
  assert.equal(decision.skipNonEssentialShaping, true);
});

test("decorate reliability prewarm is opportunistic and non-blocking", async () => {
  const events: string[] = [];
  const executed: string[] = [];
  await runDecorateReliabilityPrewarm({
    requestId: "req-1",
    runStep: async (step) => {
      executed.push(step);
      if (step === "minimal_server_payload_scaffold") {
        throw new Error("prewarm_miss");
      }
    },
    onTelemetry: (event) => events.push(event),
  });
  assert.ok(executed.length >= 3);
  assert.ok(events.includes("decorate_prewarm_started"));
  assert.ok(events.includes("decorate_prewarm_skipped"));
  assert.ok(events.includes("decorate_prewarm_completed"));
});

test("decorate controller emits SLA breach/recovery checkpoints", async () => {
  let seq = 0;
  const sla: string[] = [];
  const controller = createDecorateController({
    createRequestId: () => `req-${++seq}`,
    onSkip: () => {},
    onClick: () => {},
    onInvariantViolation: () => {},
    onSlaEvent: (event) => sla.push(event.type),
    slaConfig: { kickoffMs: 10 },
    executeStart: async (_prompt, context) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      context.setPhase("server_kickoff");
      context.markServerPlanStart();
      return { ok: true, requestId: context.requestId, reason: "preview_ready", mode: "llm" };
    },
    executeApplyPending: async () => {},
    executeUndo: async () => {},
  });

  const result = await controller.startDecorate("hello");
  assert.equal(result.ok, true);
  assert.ok(sla.includes("decorate_sla_started"));
  assert.ok(sla.includes("decorate_sla_breached"));
  assert.ok(sla.includes("decorate_sla_recovered"));
});
