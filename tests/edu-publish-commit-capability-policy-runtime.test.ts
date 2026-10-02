import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import {
  EDU_PUBLISH_CAPABILITY_POLICY_MODE_ENV,
  loadEduPublishCapabilityPolicyMode,
  parseEduPublishCapabilityPolicyMode,
} from "@/lib/server/edu/publish/commitCapabilityPolicyRuntime";

const OBSERVE_DEFAULT = { mode: "observe", source: "default" } as const;
const OBSERVE_CONFIGURED = { mode: "observe", source: "configured" } as const;
const ENFORCE_CONFIGURED = { mode: "enforce_present", source: "configured" } as const;
const INVALID_FALLBACK = { mode: "observe", source: "invalid_fallback" } as const;
const EVALUATION_FAILED_FALLBACK = {
  mode: "observe",
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
    /value|rawValue|env|environment|error|message|secret|token|kid|key|private-policy-env-sentinel|private-secret-sentinel|private-token-sentinel|private-kid-sentinel/,
  );
}

test("parses missing policy mode as the observe default", () => {
  for (const value of [undefined, null, "", " ", "\t\n"]) {
    assertSafeResult(parseEduPublishCapabilityPolicyMode(value), OBSERVE_DEFAULT);
  }
});

test("parses only the exact configured observe mode", () => {
  for (const value of ["observe", " observe "]) {
    assertSafeResult(parseEduPublishCapabilityPolicyMode(value), OBSERVE_CONFIGURED);
  }
});

test("parses only the exact configured enforce_present mode", () => {
  for (const value of ["enforce_present", " enforce_present "]) {
    assertSafeResult(parseEduPublishCapabilityPolicyMode(value), ENFORCE_CONFIGURED);
  }
});

test("falls back to observe for every invalid parser input", () => {
  const invalidValues: unknown[] = [
    "OBSERVE",
    "ENFORCE_PRESENT",
    "enforce-present",
    "enforce",
    "required",
    "1",
    "true",
    "on",
    "production",
    "0",
    "false",
    1,
    true,
    {},
    [],
  ];

  for (const value of invalidValues) {
    assert.doesNotThrow(() => parseEduPublishCapabilityPolicyMode(value));
    assertSafeResult(parseEduPublishCapabilityPolicyMode(value), INVALID_FALLBACK);
  }
});

test("loads configured modes from the injected runtime environment", () => {
  assertSafeResult(
    loadEduPublishCapabilityPolicyMode({
      [EDU_PUBLISH_CAPABILITY_POLICY_MODE_ENV]: "observe",
    }),
    OBSERVE_CONFIGURED,
  );
  assertSafeResult(
    loadEduPublishCapabilityPolicyMode({
      [EDU_PUBLISH_CAPABILITY_POLICY_MODE_ENV]: "enforce_present",
    }),
    ENFORCE_CONFIGURED,
  );
  assertSafeResult(loadEduPublishCapabilityPolicyMode({}), OBSERVE_DEFAULT);
});

test("ignores additive environment values and keeps the result secret-free", () => {
  const source = {
    [EDU_PUBLISH_CAPABILITY_POLICY_MODE_ENV]: "observe",
    DATABASE_URL: "private-secret-sentinel",
    TURNSTILE_SECRET_KEY: "private-token-sentinel",
    futureMode: "future-mode-sentinel",
    kid: "private-kid-sentinel",
  };
  const before = structuredClone(source);

  assertSafeResult(loadEduPublishCapabilityPolicyMode(source), OBSERVE_CONFIGURED);
  assert.deepEqual(source, before);
  assert.doesNotMatch(JSON.stringify(loadEduPublishCapabilityPolicyMode(source)), /private-secret-sentinel|private-token-sentinel|future-mode-sentinel|private-kid-sentinel/);
});

test("falls back safely when runtime environment evaluation throws", () => {
  const source = new Proxy(
    {},
    {
      get() {
        throw new Error("private-policy-env-sentinel");
      },
    },
  );

  assert.doesNotThrow(() => loadEduPublishCapabilityPolicyMode(source));
  assertSafeResult(
    loadEduPublishCapabilityPolicyMode(source),
    EVALUATION_FAILED_FALLBACK,
  );
});

test("does not mutate parser input and is deterministic", () => {
  const input = " enforce_present ";
  const before = input;
  const first = parseEduPublishCapabilityPolicyMode(input);
  const second = parseEduPublishCapabilityPolicyMode(input);

  assert.deepEqual(first, second);
  assert.equal(input, before);
});

test("reads the latest value on every load without caching", () => {
  const source: Record<string, unknown> = {
    [EDU_PUBLISH_CAPABILITY_POLICY_MODE_ENV]: "observe",
  };

  assertSafeResult(loadEduPublishCapabilityPolicyMode(source), OBSERVE_CONFIGURED);
  source[EDU_PUBLISH_CAPABILITY_POLICY_MODE_ENV] = "enforce_present";
  assertSafeResult(loadEduPublishCapabilityPolicyMode(source), ENFORCE_CONFIGURED);
  delete source[EDU_PUBLISH_CAPABILITY_POLICY_MODE_ENV];
  assertSafeResult(loadEduPublishCapabilityPolicyMode(source), OBSERVE_DEFAULT);
});

test("never enables enforce_present for invalid values", () => {
  const invalidValues = ["1", "true", "on", "enabled", "production", "NODE_ENV=production", "ENFORCE_PRESENT", "enforce-present"];

  for (const value of invalidValues) {
    assert.notEqual(parseEduPublishCapabilityPolicyMode(value).mode, "enforce_present");
    assert.notEqual(loadEduPublishCapabilityPolicyMode({ [EDU_PUBLISH_CAPABILITY_POLICY_MODE_ENV]: value }).mode, "enforce_present");
  }
});

test("keeps the runtime adapter independent from request and policy execution code", async () => {
  const { readFile } = await import("node:fs/promises");
  const modulePath = path.join(
    process.cwd(),
    "lib/server/edu/publish/commitCapabilityPolicyRuntime.ts",
  );
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(
    source,
    /NextRequest|Response|handleEduPublishCommit|Supabase|Cloudflare|recordOpsEvent|node:crypto|Buffer|Date\.now|crypto|decideEduPublishCapabilityPolicy/,
  );
  assert.doesNotMatch(source, /PUBLISH_CAPABILITY_REQUIRED|reject_missing|enforce_all/);
});
