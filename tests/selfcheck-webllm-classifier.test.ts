import assert from "node:assert/strict";
import test from "node:test";

import { classifyWebllmFailure } from "@/lib/edu/selfcheck/webllmFailureClassifier";
import { isContainedRolloutReadyToAttempt } from "@/lib/edu/llm/webllmContainedRolloutSnapshot";
import {
  buildWebllmContainedAttemptEvidence,
  type WebllmContainedAttemptEvidence,
} from "@/lib/edu/llm/webllmContainedRolloutEvidence";

test("health missingKeys가 비어있으면 env 토큰이 있어도 engine_error로 분류한다", () => {
  const reason = classifyWebllmFailure({
    detail: "engine error / EDU_WEBLLM_ENV_MISSING",
    resultReason: "engine_error",
    progressMessage: "",
    healthMissingKeys: [],
  });

  assert.equal(reason, "engine_error");
});

test("health missingKeys가 있으면 env 토큰을 env_missing으로 분류한다", () => {
  const reason = classifyWebllmFailure({
    detail: "config_missing: EDU_WEBLLM_ENV_MISSING",
    resultReason: "engine_error",
    progressMessage: "",
    healthMissingKeys: ["NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID"],
  });

  assert.equal(reason, "env_missing");
});

test("selfcheck readiness gate interprets operator state via shared contained snapshot helper", () => {
  assert.equal(isContainedRolloutReadyToAttempt("ready_to_attempt"), true);
  assert.equal(isContainedRolloutReadyToAttempt("fallback_only"), false);
  assert.equal(isContainedRolloutReadyToAttempt("env_not_ready"), false);
});

test("selfcheck evidence row rendering can consume shared evidence shape", () => {
  const row: WebllmContainedAttemptEvidence = buildWebllmContainedAttemptEvidence({
    lessonIdSafe: "1",
    operatorStateAtAttempt: "ready_to_attempt",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    degradedBlocked: false,
    killSwitchOn: false,
    dispatchMode: "webllm_contained",
    attemptDecision: "attempted_local",
    outcome: "success",
    safeReason: "contained_dispatch_enabled",
    safeSummary: "ready_to_attempt · attempted_local · success",
  });

  const line = `${row.operatorStateAtAttempt} · ${row.attemptDecision} · ${row.outcome}`;
  assert.equal(line, "ready_to_attempt · attempted_local · success");
});


test("selfcheck client references shared rollout handoff pack helper", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("app/edu/selfcheck/SelfcheckClient.tsx", "utf8");
  assert.equal(source.includes("buildWebllmContainedRolloutHandoffPack"), true);
  assert.equal(source.includes("Go/No-Go handoff"), true);
});
