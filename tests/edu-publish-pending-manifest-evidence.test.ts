import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyPendingManifestEvidenceForForwarding,
  type PendingPublishManifestEvidenceFields,
} from "@/lib/edu/publish/pendingManifestEvidence";

const DIGEST = "a".repeat(64);
const RAW_HTML = "private-html-content-sentinel";
const RAW_BYTES = "private-file-bytes-sentinel";

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
        rawContent: RAW_HTML,
        bytes: RAW_BYTES,
      },
    ],
    privateContent: RAW_HTML,
  };
}

function evidence(overrides: PendingPublishManifestEvidenceFields = {}) {
  return {
    manifestSchemaVersion: 1,
    declaredManifestDigest: DIGEST,
    declaredManifest: manifest(),
    ...overrides,
  };
}

test("classifies missing evidence as legacy", () => {
  assert.deepEqual(classifyPendingManifestEvidenceForForwarding({}), { mode: "legacy" });
  assert.deepEqual(
    classifyPendingManifestEvidenceForForwarding({
      manifestSchemaVersion: undefined,
      declaredManifestDigest: undefined,
      declaredManifest: undefined,
    }),
    { mode: "legacy" },
  );
  assert.deepEqual(
    classifyPendingManifestEvidenceForForwarding({
      v: 1,
      createdAt: 0,
      shareCode: "share-code",
      lessonId: 1,
      slug: "slug",
      publishTitle: "title",
      publishFiles: [],
      assignmentId: null,
    }),
    { mode: "legacy" },
  );
});

test("forwards the exact minimal v1 evidence shape and ignores unknown fields", () => {
  const result = classifyPendingManifestEvidenceForForwarding({
    ...evidence(),
    slug: "ignored-pending-field",
    futureStorageField: "ignored-storage-field",
  });

  assert.equal(result.mode, "forwardable_v1");
  if (result.mode !== "forwardable_v1") return;
  assert.deepEqual(result.evidence, {
    manifestSchemaVersion: 1,
    declaredManifestDigest: DIGEST,
    declaredManifest: {
      schemaVersion: 1,
      entryPoint: "index.html",
      files: [{ path: "index.html", sizeBytes: 12, contentType: "text/html", sha256: DIGEST }],
    },
  });
});

test("classifies every partial evidence combination as not forwardable", () => {
  for (const presentFields of [
    ["manifestSchemaVersion"],
    ["declaredManifestDigest"],
    ["declaredManifest"],
    ["manifestSchemaVersion", "declaredManifestDigest"],
    ["manifestSchemaVersion", "declaredManifest"],
    ["declaredManifestDigest", "declaredManifest"],
  ] as const) {
    const value: Record<string, unknown> = {};
    for (const field of presentFields) value[field] = evidence()[field];
    assert.deepEqual(classifyPendingManifestEvidenceForForwarding(value), { mode: "not_forwardable" }, presentFields.join(" + "));
  }
  assert.deepEqual(classifyPendingManifestEvidenceForForwarding({ manifestSchemaVersion: null }), { mode: "not_forwardable" });
});

test("rejects invalid schema versions", () => {
  for (const value of ["1", 0, 2, null]) {
    assert.deepEqual(
      classifyPendingManifestEvidenceForForwarding(evidence({ manifestSchemaVersion: value })),
      { mode: "not_forwardable" },
      String(value),
    );
  }
  assert.deepEqual(
    classifyPendingManifestEvidenceForForwarding(evidence({ declaredManifest: { ...manifest(), schemaVersion: 2 } })),
    { mode: "not_forwardable" },
  );
});

test("rejects invalid digest formats", () => {
  for (const value of ["a".repeat(63), "a".repeat(65), DIGEST.toUpperCase(), `${DIGEST.slice(0, 63)}g`, `sha256:${DIGEST}`, null]) {
    assert.deepEqual(
      classifyPendingManifestEvidenceForForwarding(evidence({ declaredManifestDigest: value })),
      { mode: "not_forwardable" },
      String(value),
    );
  }
});

test("rejects invalid manifest shapes", () => {
  const invalidManifests = [
    null,
    [],
    "manifest",
    { ...manifest(), schemaVersion: "1" },
    { ...manifest(), entryPoint: "main.html" },
    { ...manifest(), files: undefined },
    { ...manifest(), files: {} },
  ];

  for (const declaredManifest of invalidManifests) {
    assert.deepEqual(
      classifyPendingManifestEvidenceForForwarding(evidence({ declaredManifest })),
      { mode: "not_forwardable" },
      JSON.stringify(declaredManifest),
    );
  }
});

test("preserves forwardability through JSON round trip", () => {
  const parsed = JSON.parse(JSON.stringify({ ...evidence(), future: "ignored" })) as unknown;
  const result = classifyPendingManifestEvidenceForForwarding(parsed);
  assert.equal(result.mode, "forwardable_v1");
});

test("does not mutate input or return raw content", () => {
  const input = evidence();
  const before = structuredClone(input);
  const result = classifyPendingManifestEvidenceForForwarding(input);

  assert.deepEqual(input, before);
  assert.equal(JSON.stringify(result).includes(RAW_HTML), false);
  assert.equal(JSON.stringify(result).includes(RAW_BYTES), false);
});
