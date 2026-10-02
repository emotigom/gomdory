import assert from "node:assert/strict";
import test from "node:test";

import { getStudentRecordsProviderConfig, getStudentRecordsProviderConfigInvalidDiagnostic, getStudentRecordsProviderPublicStatus, parseAllowedUserIds } from "@/lib/student-records/providerConfig";

const allowed = "11111111-1111-4111-8111-111111111111";

test("student records provider defaults to disabled outside confirmed local development", () => {
  assert.equal(getStudentRecordsProviderConfig({ NODE_ENV: "production" }).mode, "disabled");
  assert.equal(getStudentRecordsProviderConfig({ NODE_ENV: "development", CF_PAGES: "1" }).mode, "disabled");
  assert.equal(getStudentRecordsProviderConfig({ NODE_ENV: "development" }).mode, "mock");
});

test("openai configuration requires the dedicated key, model, and UUID allowlist", () => {
  const missing = getStudentRecordsProviderConfig({ STUDENT_RECORDS_PROVIDER: "openai", OPENAI_API_KEY: "test-secret", STUDENT_RECORDS_LLM_MODEL: "test-model" });
  assert.equal(missing.configurationError, true);
  const config = getStudentRecordsProviderConfig({ STUDENT_RECORDS_PROVIDER: "openai", OPENAI_API_KEY: "test-secret", STUDENT_RECORDS_LLM_MODEL: "test-model", STUDENT_RECORDS_OPENAI_ALLOWED_USER_IDS: ` ${allowed}\n invalid ` });
  assert.equal(config.configurationError, false);
  assert.equal(config.allowedUserIds.has(allowed), true);
  assert.deepEqual(getStudentRecordsProviderPublicStatus(config, allowed), { mode: "openai", generationEnabled: true, availabilityReason: "ready", label: "AI 문구 생성 · 사용 가능" });
  assert.equal(getStudentRecordsProviderPublicStatus(config, "22222222-2222-4222-8222-222222222222").availabilityReason, "not-allowed");
  assert.equal(JSON.stringify(getStudentRecordsProviderPublicStatus(config, allowed)).includes("test-secret"), false);
});

test("allowlist accepts comma or newline delimiters, exact UUIDs, and removes duplicates", () => {
  const second = "22222222-2222-4222-8222-222222222222";
  const parsed = parseAllowedUserIds(` ${allowed},\n${second}\r\n${allowed}, <${second}> `);
  assert.deepEqual([...parsed].sort(), [allowed, second].sort());
});

test("invalid OpenAI numeric settings are a safe configuration error", () => {
  const config = getStudentRecordsProviderConfig({ STUDENT_RECORDS_PROVIDER: "openai", OPENAI_API_KEY: "test-secret", STUDENT_RECORDS_LLM_MODEL: "test-model", STUDENT_RECORDS_OPENAI_ALLOWED_USER_IDS: allowed, STUDENT_RECORDS_LLM_TIMEOUT_MS: "1" });
  assert.equal(getStudentRecordsProviderPublicStatus(config, allowed).availabilityReason, "configuration-error");
});

test("OpenAI numeric settings accept their inclusive documented bounds", () => {
  for (const [timeoutMs, maxOutputTokens] of [["5000", "512"], ["30000", "4000"]]) {
    const config = getStudentRecordsProviderConfig({
      STUDENT_RECORDS_PROVIDER: "openai",
      OPENAI_API_KEY: "test-secret",
      STUDENT_RECORDS_LLM_MODEL: "test-model",
      STUDENT_RECORDS_OPENAI_ALLOWED_USER_IDS: allowed,
      STUDENT_RECORDS_LLM_TIMEOUT_MS: timeoutMs,
      STUDENT_RECORDS_LLM_MAX_OUTPUT_TOKENS: maxOutputTokens,
    });
    assert.equal(config.configurationError, false);
  }
});

test("invalid configuration diagnostic contains only presence, validity, and count signals", () => {
  const diagnostic = getStudentRecordsProviderConfigInvalidDiagnostic({
    STUDENT_RECORDS_PROVIDER: "openai",
    OPENAI_API_KEY: "test-secret",
    STUDENT_RECORDS_LLM_MODEL: "test-model",
    STUDENT_RECORDS_OPENAI_ALLOWED_USER_IDS: "not-a-uuid",
    STUDENT_RECORDS_LLM_TIMEOUT_MS: "30001",
    STUDENT_RECORDS_LLM_MAX_OUTPUT_TOKENS: "511",
  });
  assert.deepEqual(diagnostic, {
    event: "student_records_provider_config_invalid",
    providerModeValid: true,
    apiKeyPresent: true,
    modelPresent: true,
    allowlistValid: false,
    allowedUserCount: 0,
    timeoutValid: false,
    maxOutputTokensValid: false,
  });
  assert.equal(JSON.stringify(diagnostic).includes("test-secret"), false);
  assert.equal(JSON.stringify(diagnostic).includes("test-model"), false);
});
