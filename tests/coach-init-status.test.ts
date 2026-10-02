import assert from "node:assert/strict";
import test from "node:test";

import { finalizeCoachInit, resolveCoachInitPrecondition } from "@/lib/edu/selfcheck/coachInitStatus";

test("coach init precondition returns skipped reasons", () => {
  assert.equal(
    resolveCoachInitPrecondition({
      healthReady: false,
      hardDisabled: false,
      coachModelId: "coach",
      coachWasmUrl: "https://example.com/coach.wasm",
      webGpuSupported: true,
    }).reasonCode,
    "health_not_ready",
  );

  assert.equal(
    resolveCoachInitPrecondition({
      healthReady: true,
      hardDisabled: true,
      coachModelId: "coach",
      coachWasmUrl: "https://example.com/coach.wasm",
      webGpuSupported: true,
    }).reasonCode,
    "hard_disabled",
  );

  assert.equal(
    resolveCoachInitPrecondition({
      healthReady: true,
      hardDisabled: false,
      coachModelId: "coach",
      coachWasmUrl: null,
      webGpuSupported: true,
    }).reasonCode,
    "coach_config_missing",
  );
});

test("coach init transition covers attempting/loaded/failed", () => {
  const attempting = resolveCoachInitPrecondition({
    healthReady: true,
    hardDisabled: false,
    coachModelId: "coach",
    coachWasmUrl: "https://example.com/coach.wasm",
    webGpuSupported: true,
  });
  assert.equal(attempting.status, "attempting");
  assert.equal(attempting.attempted, true);

  assert.equal(finalizeCoachInit({ ok: true }).status, "loaded");
  assert.equal(finalizeCoachInit({ ok: false }).status, "failed");
  assert.equal(finalizeCoachInit({ ok: false, aborted: true }).reasonCode, "aborted");
});
