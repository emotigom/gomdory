import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyPendingPublishCommitForForwarding,
  selectClientPrepareAttemptIdentity,
  selectClientPreparePublishSecurity,
} from "@/lib/edu/publish/clientAttemptIdentity";

const PUBLISH_ATTEMPT_ID = "123e4567-e89b-12d3-a456-426614174000";
const DIGEST = "a".repeat(64);
const OTHER_DIGEST = "b".repeat(64);

function manifest() {
  return {
    schemaVersion: 1,
    entryPoint: "index.html",
    files: [
      {
        path: "index.html",
        sizeBytes: 12,
        contentType: "text/html",
        sha256: DIGEST,
      },
    ],
  };
}

function localEvidence(overrides: Record<string, unknown> = {}) {
  return {
    manifestSchemaVersion: 1 as const,
    declaredManifestDigest: DIGEST,
    declaredManifest: manifest(),
    ...overrides,
  };
}

function validResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    slug: "lesson-slug",
    uploads: [],
    publishAttemptId: PUBLISH_ATTEMPT_ID,
    declaredManifestDigest: DIGEST,
    manifestSchemaVersion: 1,
    ...overrides,
  };
}

function pending(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    createdAt: 1,
    shareCode: "share-code",
    lessonId: 1,
    slug: "lesson-slug",
    publishTitle: "Lesson",
    publishFiles: [{ path: "index.html", contentType: "text/html", sizeBytes: 12 }],
    assignmentId: null,
    ...localEvidence(),
    ...overrides,
  };
}

test("selects an attempt only when response and local evidence match exactly", () => {
  assert.deepEqual(selectClientPrepareAttemptIdentity(validResponse(), localEvidence()), {
    mode: "attempt_v1",
    publishAttemptId: PUBLISH_ATTEMPT_ID,
  });
});

test("keeps old-server and missing-local-evidence responses unavailable", () => {
  assert.deepEqual(selectClientPrepareAttemptIdentity({}, localEvidence()), { mode: "not_available" });
  assert.deepEqual(selectClientPrepareAttemptIdentity(validResponse(), null), { mode: "not_available" });
});

test("rejects every partial response combination", () => {
  const cases = [
    { publishAttemptId: PUBLISH_ATTEMPT_ID },
    { declaredManifestDigest: DIGEST },
    { manifestSchemaVersion: 1 },
    { publishAttemptId: PUBLISH_ATTEMPT_ID, declaredManifestDigest: DIGEST },
    { publishAttemptId: PUBLISH_ATTEMPT_ID, manifestSchemaVersion: 1 },
    { declaredManifestDigest: DIGEST, manifestSchemaVersion: 1 },
  ];

  for (const fields of cases) {
    assert.deepEqual(selectClientPrepareAttemptIdentity(fields, localEvidence()), { mode: "not_available" });
  }
});

test("rejects malformed, unsupported, and mismatched response fields", () => {
  for (const fields of [
    { publishAttemptId: PUBLISH_ATTEMPT_ID.toUpperCase() },
    { publishAttemptId: "not-a-uuid" },
    { declaredManifestDigest: "A".repeat(64) },
    { declaredManifestDigest: "not-a-digest" },
    { manifestSchemaVersion: 2 },
    { manifestSchemaVersion: "1" },
    { declaredManifestDigest: OTHER_DIGEST },
    { manifestSchemaVersion: 2 },
  ]) {
    assert.deepEqual(selectClientPrepareAttemptIdentity(validResponse(fields), localEvidence()), { mode: "not_available" });
  }
});

test("ignores unknown response fields and does not mutate inputs", () => {
  const response = validResponse({ futureCapabilityVersion: "private-capability-sentinel", futureServerField: "future" });
  const evidence = localEvidence();
  const responseBefore = structuredClone(response);
  const evidenceBefore = structuredClone(evidence);

  assert.deepEqual(selectClientPrepareAttemptIdentity(response, evidence), {
    mode: "attempt_v1",
    publishAttemptId: PUBLISH_ATTEMPT_ID,
  });
  assert.deepEqual(response, responseBefore);
  assert.deepEqual(evidence, evidenceBefore);
});

test("forwards an opaque prepare capability only with a matching attempt", () => {
  const capability = "looks.not-like-a-valid-capability.signature";
  assert.deepEqual(selectClientPreparePublishSecurity(validResponse({ publishCapability: capability }), localEvidence()), {
    mode: "capability_opaque",
    fields: {
      publishAttemptId: PUBLISH_ATTEMPT_ID,
      publishCapability: capability,
    },
  });

  assert.deepEqual(selectClientPreparePublishSecurity(validResponse({ publishCapability: capability }), null), {
    mode: "not_available",
    fields: {},
  });
});

test("keeps old-server attempts and rejects non-forwardable capability values", () => {
  assert.deepEqual(selectClientPreparePublishSecurity(validResponse(), localEvidence()), {
    mode: "attempt_v1",
    fields: { publishAttemptId: PUBLISH_ATTEMPT_ID },
  });

  for (const publishCapability of [
    undefined,
    null,
    42,
    {},
    "",
    "x".repeat(513),
    "before\u0000after",
    "before\nafter",
    "before\u007fafter",
  ]) {
    assert.deepEqual(
      selectClientPreparePublishSecurity(validResponse({ publishCapability }), localEvidence()),
      { mode: "attempt_v1", fields: { publishAttemptId: PUBLISH_ATTEMPT_ID } },
      String(publishCapability),
    );
  }
});

test("preserves opaque-looking capability strings and does not mutate selection inputs", () => {
  const response = validResponse({ publishCapability: "v9/unknown.segment/possibly-invalid-signature" });
  const evidence = localEvidence();
  const responseBefore = structuredClone(response);
  const evidenceBefore = structuredClone(evidence);

  assert.deepEqual(selectClientPreparePublishSecurity(response, evidence), {
    mode: "capability_opaque",
    fields: {
      publishAttemptId: PUBLISH_ATTEMPT_ID,
      publishCapability: response.publishCapability,
    },
  });
  assert.deepEqual(response, responseBefore);
  assert.deepEqual(evidence, evidenceBefore);
});

test("forwards legacy and manifest-only pending commits", () => {
  assert.deepEqual(classifyPendingPublishCommitForForwarding({}), { mode: "legacy", fields: {} });

  const result = classifyPendingPublishCommitForForwarding(pending({ publishAttemptId: undefined }));
  assert.deepEqual(result, { mode: "manifest_v1", fields: localEvidence() });
});

test("forwards a valid pending attempt as an all-or-none four-field payload", () => {
  assert.deepEqual(classifyPendingPublishCommitForForwarding(pending({ publishAttemptId: PUBLISH_ATTEMPT_ID })), {
    mode: "attempt_v1",
    fields: {
      publishAttemptId: PUBLISH_ATTEMPT_ID,
      ...localEvidence(),
    },
  });
});

test("forwards a valid pending capability with all five fields", () => {
  const publishCapability = "opaque-capability-without-client-validation";
  assert.deepEqual(
    classifyPendingPublishCommitForForwarding(pending({ publishAttemptId: PUBLISH_ATTEMPT_ID, publishCapability })),
    {
      mode: "capability_opaque",
      fields: {
        publishCapability,
        publishAttemptId: PUBLISH_ATTEMPT_ID,
        ...localEvidence(),
      },
    },
  );
});

test("falls back to attempt or manifest forwarding when capability transport is unavailable", () => {
  for (const publishCapability of [null, 42, {}, "", "x".repeat(513), "bad\nvalue"]) {
    assert.deepEqual(
      classifyPendingPublishCommitForForwarding(
        pending({ publishAttemptId: PUBLISH_ATTEMPT_ID, publishCapability }),
      ),
      { mode: "attempt_v1", fields: { publishAttemptId: PUBLISH_ATTEMPT_ID, ...localEvidence() } },
      String(publishCapability),
    );
  }

  assert.deepEqual(
    classifyPendingPublishCommitForForwarding(
      pending({ publishAttemptId: "not-a-uuid", publishCapability: "opaque-capability" }),
    ),
    { mode: "manifest_v1", fields: localEvidence() },
  );
});

test("falls back to manifest-only for invalid pending attempts", () => {
  for (const publishAttemptId of [PUBLISH_ATTEMPT_ID.toUpperCase(), "not-a-uuid", "", null]) {
    const result = classifyPendingPublishCommitForForwarding(pending({ publishAttemptId }));
    assert.deepEqual(result, { mode: "manifest_v1", fields: localEvidence() }, String(publishAttemptId));
  }
});

test("rejects malformed manifest evidence even when the pending attempt is valid", () => {
  assert.deepEqual(
    classifyPendingPublishCommitForForwarding(pending({ publishAttemptId: PUBLISH_ATTEMPT_ID, declaredManifest: null })),
    { mode: "not_forwardable", fields: {} },
  );
});

test("preserves a valid pending attempt through JSON round trip without sensitive fields", () => {
  const publishCapability = "opaque-capability-survives-json-round-trip";
  const parsed = JSON.parse(JSON.stringify({
    ...pending({
      publishAttemptId: PUBLISH_ATTEMPT_ID,
      publishCapability,
      privateHtml: "private-html-content-sentinel",
      privateBytes: "private-file-bytes-sentinel",
      privateCapability: "private-capability-sentinel",
    }),
  })) as unknown;
  const result = classifyPendingPublishCommitForForwarding(parsed);

  assert.deepEqual(result, {
    mode: "capability_opaque",
    fields: {
      publishCapability,
      publishAttemptId: PUBLISH_ATTEMPT_ID,
      ...localEvidence(),
    },
  });
  assert.equal(JSON.stringify(result).includes("private-html-content-sentinel"), false);
  assert.equal(JSON.stringify(result).includes("private-file-bytes-sentinel"), false);
  assert.equal(JSON.stringify(result).includes("private-capability-sentinel"), false);
});
