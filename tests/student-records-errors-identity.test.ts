import assert from "node:assert/strict";
import test from "node:test";
import { isRetryableGenerationCode, isRetryableHttpError, NETWORK_ERROR_MESSAGE, safeGenerationCodeMessage, safeHttpErrorMessage } from "@/lib/student-records/httpErrors";
import { hasExpectedResponseIdentity } from "@/lib/student-records/responseIdentity";
import type { GenerateBatchResponse } from "@/lib/student-records/contracts";

test("safe client errors map HTTP and provider status without server messages", () => {
  assert.match(safeHttpErrorMessage(400), /생성 요청 형식/);
  assert.match(safeHttpErrorMessage(401), /로그인/);
  assert.match(safeHttpErrorMessage(403), /권한/);
  assert.match(safeHttpErrorMessage(413), /너무 큽니다/);
  assert.match(safeHttpErrorMessage(429), /요청이 많습니다/);
  assert.match(safeHttpErrorMessage(503), /처리하지 못했습니다/);

  const guestMessage = safeHttpErrorMessage(401, { accessMode: "guest" });
  assert.match(guestMessage, /초대 링크를 다시 열어주세요/);
  assert.match(safeHttpErrorMessage(401, { accessMode: "guest", code: "unauthorized" }), /초대 링크를 다시 열어주세요/);

  const authenticatedMessage = safeHttpErrorMessage(401, { accessMode: "authenticated", code: "unauthorized" });
  assert.match(authenticatedMessage, /로그인/);
  assert.doesNotMatch(authenticatedMessage, /초대 링크/);

  const unspecifiedAccessModeMessage = safeHttpErrorMessage(401, { code: "unauthorized" });
  assert.match(unspecifiedAccessModeMessage, /로그인/);
  assert.doesNotMatch(unspecifiedAccessModeMessage, /초대 링크/);

  const internalDetailMessage = safeHttpErrorMessage(500, { code: "internal-provider-secret-detail" });
  assert.doesNotMatch(internalDetailMessage, /internal-provider-secret-detail/);

  assert.equal(isRetryableHttpError(401), false);
  assert.equal(isRetryableHttpError(403), false);
  assert.equal(isRetryableHttpError(408), false);
  assert.equal(isRetryableHttpError(425), false);
  assert.equal(isRetryableHttpError(429), true);
  assert.equal(isRetryableHttpError(500), true);
  assert.equal(isRetryableHttpError(503), true);
  assert.equal(isRetryableHttpError(599), true);
  assert.equal(isRetryableHttpError(600), false);
  assert.match(NETWORK_ERROR_MESSAGE, /연결/); assert.equal(safeGenerationCodeMessage("INVALID_OUTPUT"), "생성 결과를 확인하지 못했습니다.");
});

test("generation retry policy is explicit and fail-closed", () => {
  for (const code of ["INVALID_INPUT", "PROVIDER_DISABLED", "PROVIDER_CONFIGURATION", "PROVIDER_REFUSED", "INVALID_OUTPUT", "UNKNOWN_CODE", ""]) {
    assert.equal(isRetryableGenerationCode(code), false, code);
  }
  for (const code of ["PROVIDER_RATE_LIMITED", "PROVIDER_TIMEOUT_UNKNOWN", "PROVIDER_INCOMPLETE", "PROVIDER_UNAVAILABLE"]) {
    assert.equal(isRetryableGenerationCode(code), true, code);
  }
  assert.equal(isRetryableGenerationCode("PROVIDER_UNAVAILABLE_SUFFIX"), false);
  assert.equal(isRetryableGenerationCode("provider_unavailable"), false);
});

test("response identity requires both operation and batch IDs", () => {
  const response: GenerateBatchResponse = { ok: true, requestId: "request", operationId: "operation-a", batchId: "batch-a", results: [] };
  assert.equal(hasExpectedResponseIdentity(response, "operation-a", "batch-a"), true);
  assert.equal(hasExpectedResponseIdentity(response, "operation-b", "batch-a"), false);
  assert.equal(hasExpectedResponseIdentity(response, "operation-a", "batch-b"), false);
});
