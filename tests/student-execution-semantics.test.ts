import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveStudentExecutionRequestIdOwnership,
  resolveStudentExecutionRetryMode,
} from "@/lib/edu/lesson/studentExecutionSemantics";

test("request-id ownership distinguishes new, existing, and absent execution ownership", () => {
  assert.equal(resolveStudentExecutionRequestIdOwnership("req_123"), "existing");
  assert.equal(resolveStudentExecutionRequestIdOwnership(null), "none");
  assert.equal(resolveStudentExecutionRequestIdOwnership(undefined), "none");
});

test("retry mode stays stable for explicit retry sources", () => {
  const retrySources = ["retry", "fallback_retry"] as const;
  assert.equal(resolveStudentExecutionRetryMode({ source: "retry", retrySources }), "retry");
  assert.equal(resolveStudentExecutionRetryMode({ source: "fallback_retry", retrySources }), "retry");
  assert.equal(resolveStudentExecutionRetryMode({ source: "enter", retrySources: ["retry"] as const }), "start");
});
