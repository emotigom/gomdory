import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import {
  EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV,
  EDU_PUBLISH_COMMIT_ATTEMPT_MODES,
  loadEduPublishCommitAttemptMode,
  parseEduPublishCommitAttemptMode,
} from "@/lib/server/edu/publish/commitAttemptRolloutRuntime";

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
    /value|rawValue|env|environment|error|message|secret|token|private-commit-runtime-secret-sentinel|private-runtime-error-sentinel/,
  );
}

test("exports the exact commit attempt rollout constants", () => {
  assert.equal(
    EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV,
    "EDU_PUBLISH_COMMIT_ATTEMPT_MODE",
  );
  assert.deepEqual(EDU_PUBLISH_COMMIT_ATTEMPT_MODES, ["legacy", "secured_v1"]);
  assert.equal(EDU_PUBLISH_COMMIT_ATTEMPT_MODES.length, 2);
  assert.equal(EDU_PUBLISH_COMMIT_ATTEMPT_MODES[0], "legacy");
  assert.equal(EDU_PUBLISH_COMMIT_ATTEMPT_MODES[1], "secured_v1");
  assert.notEqual(
    EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV,
    "EDU_PUBLISH_PREPARE_ATTEMPT_MODE",
  );
});

test("parses missing and blank values as the legacy default", () => {
  for (const value of [undefined, null, "", " ", "\t", "\n"]) {
    assertSafeResult(parseEduPublishCommitAttemptMode(value), LEGACY_DEFAULT);
  }
});

test("parses only the exact configured rollout modes", () => {
  for (const value of ["legacy", " legacy "]) {
    assertSafeResult(parseEduPublishCommitAttemptMode(value), LEGACY_CONFIGURED);
  }
  for (const value of ["secured_v1", " secured_v1 "]) {
    assertSafeResult(parseEduPublishCommitAttemptMode(value), SECURED_CONFIGURED);
  }
});

test("falls back to legacy for every invalid string", () => {
  const invalidValues = [
    "SECURED_V1",
    "Secured_v1",
    "secured-V1",
    "secured-v1",
    "attempt_v1",
    "observe",
    "true",
    "1",
    "enabled",
    "disabled",
    "policy_c",
    "legacy_v1",
    "secured_v2",
  ];

  for (const value of invalidValues) {
    assert.doesNotThrow(() => parseEduPublishCommitAttemptMode(value));
    assertSafeResult(parseEduPublishCommitAttemptMode(value), INVALID_FALLBACK);
  }
});

test("falls back to legacy for every invalid type without throwing", () => {
  const invalidValues: unknown[] = [
    0,
    1,
    -1,
    true,
    false,
    {},
    [],
    new Date(0),
    Symbol("secured_v1"),
    () => "secured_v1",
  ];

  for (const value of invalidValues) {
    assert.doesNotThrow(() => parseEduPublishCommitAttemptMode(value));
    assertSafeResult(parseEduPublishCommitAttemptMode(value), INVALID_FALLBACK);
  }
});

test("loads only the exact commit environment key from explicit runtime sources", () => {
  const accessedKeys: string[] = [];
  const source = new Proxy(
    {
      [EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV]: " secured_v1 ",
      EDU_PUBLISH_PREPARE_ATTEMPT_MODE: "legacy",
      secret: "private-commit-runtime-secret-sentinel",
    },
    {
      get(target, property, receiver) {
        accessedKeys.push(String(property));
        return Reflect.get(target, property, receiver);
      },
    },
  );

  assertSafeResult(loadEduPublishCommitAttemptMode(source), SECURED_CONFIGURED);
  assert.deepEqual(accessedKeys, [EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV]);

  assertSafeResult(
    loadEduPublishCommitAttemptMode({
      EDU_PUBLISH_PREPARE_ATTEMPT_MODE: "secured_v1",
    }),
    LEGACY_DEFAULT,
  );
  assertSafeResult(
    loadEduPublishCommitAttemptMode({
      [EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV]: "legacy",
      EDU_PUBLISH_PREPARE_ATTEMPT_MODE: "secured_v1",
    }),
    LEGACY_CONFIGURED,
  );
});

test("keeps explicit runtime sources independent from host environment values", () => {
  const source = {
    [EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV]: "legacy",
    EDU_PUBLISH_PREPARE_ATTEMPT_MODE: "secured_v1",
    DATABASE_URL: "private-commit-runtime-secret-sentinel",
  };
  const before = structuredClone(source);

  assertSafeResult(loadEduPublishCommitAttemptMode(source), LEGACY_CONFIGURED);
  assert.deepEqual(source, before);
  assert.doesNotMatch(
    JSON.stringify(loadEduPublishCommitAttemptMode(source)),
    /private-commit-runtime-secret-sentinel/,
  );
});

test("uses an evaluation-failed fallback when runtime environment access throws", () => {
  const source = new Proxy(
    {},
    {
      get() {
        throw new Error("private-runtime-error-sentinel");
      },
    },
  );

  assert.doesNotThrow(() => loadEduPublishCommitAttemptMode(source));
  assertSafeResult(
    loadEduPublishCommitAttemptMode(source),
    EVALUATION_FAILED_FALLBACK,
  );
  assert.doesNotMatch(
    JSON.stringify(loadEduPublishCommitAttemptMode(source)),
    /private-runtime-error-sentinel/,
  );
});

test("returns fresh results and isolates parser and loader result mutation", () => {
  const parserInputs: unknown[] = [undefined, "invalid", "legacy", "secured_v1"];
  for (const input of parserInputs) {
    const first = parseEduPublishCommitAttemptMode(input);
    first.mode = "secured_v1";
    first.source = "configured";
    const second = parseEduPublishCommitAttemptMode(input);
    assert.notStrictEqual(first, second);
    assertSafeResult(
      second,
      input === undefined
        ? LEGACY_DEFAULT
        : input === "invalid"
          ? INVALID_FALLBACK
          : input === "legacy"
            ? LEGACY_CONFIGURED
            : SECURED_CONFIGURED,
    );
  }

  const source = {
    [EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV]: "secured_v1",
  };
  const firstLoaderResult = loadEduPublishCommitAttemptMode(source);
  firstLoaderResult.mode = "legacy";
  firstLoaderResult.source = "invalid_fallback";
  const secondLoaderResult = loadEduPublishCommitAttemptMode(source);
  assert.notStrictEqual(firstLoaderResult, secondLoaderResult);
  assertSafeResult(secondLoaderResult, SECURED_CONFIGURED);
});

test("is deterministic, uncached, and does not mutate runtime sources", () => {
  for (const input of [undefined, "legacy", "secured_v1", "invalid"]) {
    const first = parseEduPublishCommitAttemptMode(input);
    const second = parseEduPublishCommitAttemptMode(input);
    assert.deepEqual(first, second);
    assert.notStrictEqual(first, second);
  }

  const source: Record<string, unknown> = {
    [EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV]: " secured_v1 ",
    DATABASE_URL: "private-commit-runtime-secret-sentinel",
  };
  const before = structuredClone(source);
  const first = loadEduPublishCommitAttemptMode(source);
  const second = loadEduPublishCommitAttemptMode(source);

  assert.deepEqual(first, second);
  assert.notStrictEqual(first, second);
  assert.deepEqual(source, before);

  source[EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV] = "legacy";
  assertSafeResult(loadEduPublishCommitAttemptMode(source), LEGACY_CONFIGURED);
  delete source[EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV];
  assertSafeResult(loadEduPublishCommitAttemptMode(source), LEGACY_DEFAULT);
});

test("keeps prepare rollout configuration independent from commit rollout", async () => {
  assert.notEqual(
    EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV,
    "EDU_PUBLISH_PREPARE_ATTEMPT_MODE",
  );

  assertSafeResult(
    loadEduPublishCommitAttemptMode({
      EDU_PUBLISH_PREPARE_ATTEMPT_MODE: "secured_v1",
    }),
    LEGACY_DEFAULT,
  );
  assertSafeResult(
    loadEduPublishCommitAttemptMode({
      EDU_PUBLISH_PREPARE_ATTEMPT_MODE: "legacy",
      [EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV]: "secured_v1",
    }),
    SECURED_CONFIGURED,
  );

  const { readFile } = await import("node:fs/promises");
  const modulePath = path.join(
    process.cwd(),
    "lib/server/edu/publish/commitAttemptRolloutRuntime.ts",
  );
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(
    source,
    /prepareAttemptRolloutRuntime|loadEduPublishPrepareAttemptMode|EDU_PUBLISH_PREPARE_ATTEMPT_MODE|beginCommitCoordinator|coordinateEduPublishCommitBegin|beginEduPublishCommitViaRpc|handleEduPublishCommit|verifyEduPublishCommitCapability|createSupabaseAdminClient|headObject|listObjectKeysV2|recordOpsEvent|Date\.now|Math\.random|randomUUID|process\.env\s*=/,
  );
  assert.match(source, /source \?\? getRuntimeEnv\(\)/);
  assert.match(source, /readEnvStringFrom\(/);
});
