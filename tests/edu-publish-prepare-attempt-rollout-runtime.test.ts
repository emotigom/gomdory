import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import {
  EDU_PUBLISH_PREPARE_ATTEMPT_MODE_ENV,
  EDU_PUBLISH_PREPARE_ATTEMPT_MODES,
  loadEduPublishPrepareAttemptMode,
  parseEduPublishPrepareAttemptMode,
} from "@/lib/server/edu/publish/prepareAttemptRolloutRuntime";

const LEGACY_DEFAULT = { mode: "legacy", source: "default" } as const;
const LEGACY_CONFIGURED = { mode: "legacy", source: "configured" } as const;
const SECURED_CONFIGURED = { mode: "secured_v1", source: "configured" } as const;
const INVALID_FALLBACK = { mode: "legacy", source: "invalid_fallback" } as const;
const EVALUATION_FAILED_FALLBACK = {
  mode: "legacy",
  source: "evaluation_failed_fallback",
} as const;

function assertSafeResult(
  actual: unknown,
  expected: { mode: string; source: string },
) {
  assert.deepEqual(actual, expected);
  assert.deepEqual(Object.keys(actual as object).sort(), ["mode", "source"]);
  assert.doesNotMatch(
    JSON.stringify(actual),
    /value|rawValue|env|environment|error|message|secret|token|private-runtime-secret-sentinel/,
  );
}

test("exports the exact prepare attempt rollout constants", () => {
  assert.equal(
    EDU_PUBLISH_PREPARE_ATTEMPT_MODE_ENV,
    "EDU_PUBLISH_PREPARE_ATTEMPT_MODE",
  );
  assert.deepEqual(EDU_PUBLISH_PREPARE_ATTEMPT_MODES, ["legacy", "secured_v1"]);
});

test("parses missing and blank values as the legacy default", () => {
  for (const value of [undefined, null, "", " ", "\t\n"]) {
    assertSafeResult(parseEduPublishPrepareAttemptMode(value), LEGACY_DEFAULT);
  }
});

test("parses only the exact configured rollout modes", () => {
  for (const value of ["legacy", " legacy "]) {
    assertSafeResult(parseEduPublishPrepareAttemptMode(value), LEGACY_CONFIGURED);
  }
  for (const value of ["secured_v1", " secured_v1 "]) {
    assertSafeResult(parseEduPublishPrepareAttemptMode(value), SECURED_CONFIGURED);
  }
});

test("falls back to legacy for invalid strings", () => {
  const invalidValues = [
    "SECURED_V1",
    "secured-v1",
    "attempt_v1",
    "observe",
    "true",
    "1",
    "legacy_v1",
    "secured_v2",
  ];

  for (const value of invalidValues) {
    assert.doesNotThrow(() => parseEduPublishPrepareAttemptMode(value));
    assertSafeResult(parseEduPublishPrepareAttemptMode(value), INVALID_FALLBACK);
  }
});

test("falls back to legacy for invalid types without throwing", () => {
  const invalidValues: unknown[] = [
    0,
    1,
    true,
    false,
    {},
    [],
    Symbol("invalid-mode"),
    () => "secured_v1",
  ];

  for (const value of invalidValues) {
    assert.doesNotThrow(() => parseEduPublishPrepareAttemptMode(value));
    assertSafeResult(parseEduPublishPrepareAttemptMode(value), INVALID_FALLBACK);
  }
});

test("loads the exact mode from explicit runtime sources", () => {
  assertSafeResult(loadEduPublishPrepareAttemptMode({}), LEGACY_DEFAULT);
  assertSafeResult(
    loadEduPublishPrepareAttemptMode({
      [EDU_PUBLISH_PREPARE_ATTEMPT_MODE_ENV]: "legacy",
    }),
    LEGACY_CONFIGURED,
  );
  assertSafeResult(
    loadEduPublishPrepareAttemptMode({
      [EDU_PUBLISH_PREPARE_ATTEMPT_MODE_ENV]: "secured_v1",
    }),
    SECURED_CONFIGURED,
  );
  assertSafeResult(
    loadEduPublishPrepareAttemptMode({
      [EDU_PUBLISH_PREPARE_ATTEMPT_MODE_ENV]: "invalid",
    }),
    INVALID_FALLBACK,
  );
});

test("uses an evaluation-failed fallback when runtime environment access throws", () => {
  const source = new Proxy(
    {},
    {
      get() {
        throw new Error("private-runtime-secret-sentinel");
      },
    },
  );

  assert.doesNotThrow(() => loadEduPublishPrepareAttemptMode(source));
  assertSafeResult(
    loadEduPublishPrepareAttemptMode(source),
    EVALUATION_FAILED_FALLBACK,
  );
});

test("returns fresh results and isolates result mutation", () => {
  const firstParserResult = parseEduPublishPrepareAttemptMode(undefined);
  firstParserResult.mode = "secured_v1";
  firstParserResult.source = "configured";

  const secondParserResult = parseEduPublishPrepareAttemptMode(undefined);
  assertSafeResult(secondParserResult, LEGACY_DEFAULT);

  const source = {
    [EDU_PUBLISH_PREPARE_ATTEMPT_MODE_ENV]: "secured_v1",
  };
  const firstLoaderResult = loadEduPublishPrepareAttemptMode(source);
  firstLoaderResult.mode = "legacy";
  firstLoaderResult.source = "invalid_fallback";

  const secondLoaderResult = loadEduPublishPrepareAttemptMode(source);
  assertSafeResult(secondLoaderResult, SECURED_CONFIGURED);
});

test("is deterministic, uncached, and does not mutate the environment source", () => {
  const source: Record<string, unknown> = {
    [EDU_PUBLISH_PREPARE_ATTEMPT_MODE_ENV]: " secured_v1 ",
    DATABASE_URL: "private-runtime-secret-sentinel",
  };
  const before = structuredClone(source);

  assert.deepEqual(
    loadEduPublishPrepareAttemptMode(source),
    loadEduPublishPrepareAttemptMode(source),
  );
  assert.deepEqual(source, before);
  assert.doesNotMatch(
    JSON.stringify(loadEduPublishPrepareAttemptMode(source)),
    /private-runtime-secret-sentinel/,
  );

  source[EDU_PUBLISH_PREPARE_ATTEMPT_MODE_ENV] = "legacy";
  assertSafeResult(loadEduPublishPrepareAttemptMode(source), LEGACY_CONFIGURED);
  delete source[EDU_PUBLISH_PREPARE_ATTEMPT_MODE_ENV];
  assertSafeResult(loadEduPublishPrepareAttemptMode(source), LEGACY_DEFAULT);
});

test("keeps the runtime adapter independent from request, DB, and prepare code", async () => {
  const { readFile } = await import("node:fs/promises");
  const modulePath = path.join(
    process.cwd(),
    "lib/server/edu/publish/prepareAttemptRolloutRuntime.ts",
  );
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(
    source,
    /NextRequest|NextResponse|Response|Supabase|createSupabaseAdminClient|prepareAttemptRpc|prepareEduPublishAttemptViaRpc|signEduPublish|signEduPublishCommitCapability|presign|presignPutUrl|recordOpsEvent|rateLimit|buildEdu.*Slug|node:crypto|Buffer|Date\.now|Math\.random|process\.env\s*=|handlePublishPrepareRoute/,
  );
});
