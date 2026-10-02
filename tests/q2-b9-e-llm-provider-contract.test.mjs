import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Q2-B9-E fixture is loopback-only, token-gated, and production fail-closed", () => {
  const fixture = read("lib/q2/browser/llmIntegrationFixture.ts");
  assert.match(fixture, /NODE_ENV !== "production"/);
  assert.match(fixture, /x-q2-browser-fixture-authorized/);
  assert.match(read("lib/q2/browser/studentEntryFixture.ts"), /Q2_B9_E_FIXTURE_MODE/);
  assert.match(fixture, /providerCalls \+= 1/);
});

test("Q2-B9-E preserves the guest route validation and isolates only fixture dependencies", () => {
  const route = read("app/api/v1/tools/student-records/generate-guest/route.ts");
  assert.match(route, /parseStudentRecordsGenerateRequest/);
  assert.match(route, /isQ2B9ELlmFixtureRequest/);
  assert.match(route, /fixture \? createQ2B9ELlmFixtureProvider\(\) : createStudentRecordsGuestProvider/);
  assert.match(route, /if \(!fixture\) \{/);
});

test("Q2-B9-E provider boundary retains a single stateless Responses request with timeout", () => {
  const provider = read("lib/student-records/openAiProvider.ts");
  assert.match(provider, /AbortController/);
  assert.match(provider, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(provider, /store: false/);
  assert.equal((provider.match(/fetch\(/g) ?? []).length, 1);
  assert.equal(/retry\s*\(/.test(provider), false);
});
