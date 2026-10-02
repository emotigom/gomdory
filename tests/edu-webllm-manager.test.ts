import assert from "node:assert/strict";
import test from "node:test";

import {
  assertWebLLMInitAllowed,
  disableWebLLMForSession,
  getWebLLMManagerSnapshot,
  resetWebLLMManagerSession,
} from "@/lib/edu/llm/webllmManager";

test("disableWebLLMForSession blocks future init attempts", () => {
  resetWebLLMManagerSession();
  disableWebLLMForSession("req-1", "EDU_WEBLLM_MISCONFIGURED", "broken assets");

  assert.throws(
    () => assertWebLLMInitAllowed("req-2"),
    (error: unknown) => (error as { code?: string }).code === "EDU_WEBLLM_SESSION_DISABLED",
  );

  const snapshot = getWebLLMManagerSnapshot();
  assert.equal(snapshot.state, "failed_soft");
  assert.equal(snapshot.lastErrorCode, "EDU_WEBLLM_MISCONFIGURED");
});
