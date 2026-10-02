import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyPublishAttemptCompatibility,
  EDU_PUBLISH_MANIFEST_SCHEMA_VERSION,
  type PublishAttemptEvidenceV1,
} from "@/lib/edu/publish/attemptCompatibility";

const PUBLISH_ATTEMPT_ID = "123e4567-e89b-12d3-a456-426614174000";
const DECLARED_MANIFEST_DIGEST = "a".repeat(64);
const validAttempt = {
  publishAttemptId: PUBLISH_ATTEMPT_ID,
  declaredManifestDigest: DECLARED_MANIFEST_DIGEST,
  manifestSchemaVersion: EDU_PUBLISH_MANIFEST_SCHEMA_VERSION,
};

test("classifies empty and explicitly undefined payloads as legacy", () => {
  assert.deepEqual(classifyPublishAttemptCompatibility({}), { mode: "legacy" });
  assert.deepEqual(
    classifyPublishAttemptCompatibility({
      publishAttemptId: undefined,
      declaredManifestDigest: undefined,
      manifestSchemaVersion: undefined,
    }),
    { mode: "legacy" },
  );
});

test("accepts a valid v1 attempt and preserves evidence exactly", () => {
  const evidence = {
    publishAttemptId: PUBLISH_ATTEMPT_ID,
    declaredManifestDigest: DECLARED_MANIFEST_DIGEST,
    manifestSchemaVersion: 1,
  } satisfies PublishAttemptEvidenceV1;

  assert.deepEqual(classifyPublishAttemptCompatibility(evidence), { mode: "attempt_v1", evidence });
});

test("ignores unknown additive fields", () => {
  assert.deepEqual(
    classifyPublishAttemptCompatibility({ ...validAttempt, futureField: "ignored" }),
    { mode: "attempt_v1", evidence: validAttempt },
  );
});

test("classifies every partial field combination in canonical field order", () => {
  const cases = [
    [["publishAttemptId"], { publishAttemptId: PUBLISH_ATTEMPT_ID }],
    [["declaredManifestDigest"], { declaredManifestDigest: DECLARED_MANIFEST_DIGEST }],
    [["manifestSchemaVersion"], { manifestSchemaVersion: 1 }],
    [["publishAttemptId", "declaredManifestDigest"], { publishAttemptId: PUBLISH_ATTEMPT_ID, declaredManifestDigest: DECLARED_MANIFEST_DIGEST }],
    [["publishAttemptId", "manifestSchemaVersion"], { publishAttemptId: PUBLISH_ATTEMPT_ID, manifestSchemaVersion: 1 }],
    [["declaredManifestDigest", "manifestSchemaVersion"], { declaredManifestDigest: DECLARED_MANIFEST_DIGEST, manifestSchemaVersion: 1 }],
  ] as const;

  for (const [presentFields, input] of cases) {
    assert.deepEqual(classifyPublishAttemptCompatibility(input), {
      mode: "partial",
      presentFields,
      missingFields: ["publishAttemptId", "declaredManifestDigest", "manifestSchemaVersion"].filter(
        (field) => !presentFields.includes(field as (typeof presentFields)[number]),
      ),
    });
  }
});

test("classifies malformed attempt IDs as invalid", () => {
  for (const publishAttemptId of [
    "",
    PUBLISH_ATTEMPT_ID.toUpperCase(),
    ` ${PUBLISH_ATTEMPT_ID}`,
    PUBLISH_ATTEMPT_ID.replaceAll("-", ""),
    `${PUBLISH_ATTEMPT_ID}0`,
    PUBLISH_ATTEMPT_ID.replace("a", "g"),
  ]) {
    assert.deepEqual(classifyPublishAttemptCompatibility({ ...validAttempt, publishAttemptId }), {
      mode: "invalid",
      field: "publishAttemptId",
      reason: "invalid_format",
    });
  }

  for (const publishAttemptId of [null, 42]) {
    assert.deepEqual(classifyPublishAttemptCompatibility({ ...validAttempt, publishAttemptId }), {
      mode: "invalid",
      field: "publishAttemptId",
      reason: "invalid_type",
    });
  }
});

test("classifies malformed declared digests as invalid", () => {
  for (const declaredManifestDigest of [
    "a".repeat(63),
    "a".repeat(65),
    DECLARED_MANIFEST_DIGEST.toUpperCase(),
    `${"a".repeat(63)}g`,
    `${"a".repeat(63)} `,
    `sha256:${DECLARED_MANIFEST_DIGEST}`,
  ]) {
    assert.deepEqual(classifyPublishAttemptCompatibility({ ...validAttempt, declaredManifestDigest }), {
      mode: "invalid",
      field: "declaredManifestDigest",
      reason: "invalid_format",
    });
  }

  assert.deepEqual(classifyPublishAttemptCompatibility({ ...validAttempt, declaredManifestDigest: null }), {
    mode: "invalid",
    field: "declaredManifestDigest",
    reason: "invalid_type",
  });
});

test("classifies invalid schema types and values separately from unsupported schemas", () => {
  for (const manifestSchemaVersion of ["1", null, true]) {
    assert.deepEqual(classifyPublishAttemptCompatibility({ ...validAttempt, manifestSchemaVersion }), {
      mode: "invalid",
      field: "manifestSchemaVersion",
      reason: "invalid_type",
    });
  }

  for (const manifestSchemaVersion of [Number.NaN, Infinity, 1.5, 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(classifyPublishAttemptCompatibility({ ...validAttempt, manifestSchemaVersion }), {
      mode: "invalid",
      field: "manifestSchemaVersion",
      reason: "invalid_value",
    });
  }

  for (const manifestSchemaVersion of [2, 999]) {
    assert.deepEqual(classifyPublishAttemptCompatibility({ ...validAttempt, manifestSchemaVersion }), {
      mode: "unsupported_schema",
      manifestSchemaVersion,
    });
  }
});

test("applies deterministic validation precedence", () => {
  assert.deepEqual(
    classifyPublishAttemptCompatibility({ ...validAttempt, publishAttemptId: "invalid", manifestSchemaVersion: 2 }),
    { mode: "invalid", field: "publishAttemptId", reason: "invalid_format" },
  );
  assert.deepEqual(
    classifyPublishAttemptCompatibility({ ...validAttempt, declaredManifestDigest: "invalid", manifestSchemaVersion: 2 }),
    { mode: "invalid", field: "declaredManifestDigest", reason: "invalid_format" },
  );
  assert.deepEqual(classifyPublishAttemptCompatibility({ ...validAttempt, manifestSchemaVersion: 2 }), {
    mode: "unsupported_schema",
    manifestSchemaVersion: 2,
  });
});

test("classifies non-plain payloads as invalid payload type", () => {
  for (const value of [null, [], "", 1, new Date()]) {
    assert.deepEqual(classifyPublishAttemptCompatibility(value), {
      mode: "invalid",
      field: "payload",
      reason: "invalid_type",
    });
  }
});
