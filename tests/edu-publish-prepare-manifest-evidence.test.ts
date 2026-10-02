import assert from "node:assert/strict";
import test from "node:test";

import { classifyPublishPrepareManifestEvidence } from "@/lib/edu/publish/prepareManifestEvidence";

const HTML_SHA256 = "fe26c59e91ac8de694b2531dc3bdc1b7faf471d3d7e4e00870af60f5f22897cb";
const JAVASCRIPT_SHA256 = "35c146f76e129477c64061bc84511e1090f3d4d8059713e6663dd4b35b1f7642";
const CSS_SHA256 = "15c42ab7768d955ec0667195e339104557827893b16cc3e7412c76e7c2fcd371";
const GOLDEN_SERIALIZED_MANIFEST =
  "{\"schemaVersion\":1,\"entryPoint\":\"index.html\",\"files\":[{\"path\":\"assets/app.js\",\"sizeBytes\":15,\"contentType\":\"text/javascript\",\"sha256\":\"35c146f76e129477c64061bc84511e1090f3d4d8059713e6663dd4b35b1f7642\"},{\"path\":\"assets/style.css\",\"sizeBytes\":15,\"contentType\":\"text/css\",\"sha256\":\"15c42ab7768d955ec0667195e339104557827893b16cc3e7412c76e7c2fcd371\"},{\"path\":\"index.html\",\"sizeBytes\":15,\"contentType\":\"text/html\",\"sha256\":\"fe26c59e91ac8de694b2531dc3bdc1b7faf471d3d7e4e00870af60f5f22897cb\"}]}";
const GOLDEN_MANIFEST_DIGEST = "e089f33e235fd6c4c40578b2cd5fd7d284a016499d30aa3331f1b44b06a40ba8";

const goldenManifest = {
  schemaVersion: 1,
  entryPoint: "index.html",
  files: [
    { path: "assets/app.js", sizeBytes: 15, contentType: "text/javascript", sha256: JAVASCRIPT_SHA256 },
    { path: "assets/style.css", sizeBytes: 15, contentType: "text/css", sha256: CSS_SHA256 },
    { path: "index.html", sizeBytes: 15, contentType: "text/html", sha256: HTML_SHA256 },
  ],
};

const goldenPayload = {
  manifestSchemaVersion: 1,
  declaredManifestDigest: GOLDEN_MANIFEST_DIGEST,
  declaredManifest: goldenManifest,
};

test("classifies empty and explicitly undefined evidence as legacy", async () => {
  assert.deepEqual(await classifyPublishPrepareManifestEvidence({}), { mode: "legacy" });
  assert.deepEqual(await classifyPublishPrepareManifestEvidence({
    manifestSchemaVersion: undefined,
    declaredManifestDigest: undefined,
    declaredManifest: undefined,
  }), { mode: "legacy" });
});

test("accepts a literal valid v1 payload and returns the canonical evidence", async () => {
  const result = await classifyPublishPrepareManifestEvidence(goldenPayload);

  assert.deepEqual(result, {
    mode: "declared_v1",
    evidence: {
      manifestSchemaVersion: 1,
      declaredManifestDigest: GOLDEN_MANIFEST_DIGEST,
      declaredManifest: goldenManifest,
      serializedManifest: GOLDEN_SERIALIZED_MANIFEST,
    },
  });
});

test("canonicalizes submitted file order independently", async () => {
  const result = await classifyPublishPrepareManifestEvidence({
    ...goldenPayload,
    declaredManifest: { ...goldenManifest, files: goldenManifest.files.slice().reverse() },
  });

  assert.equal(result.mode, "declared_v1");
  if (result.mode === "declared_v1") {
    assert.equal(result.evidence.serializedManifest, GOLDEN_SERIALIZED_MANIFEST);
    assert.equal(result.evidence.declaredManifestDigest, GOLDEN_MANIFEST_DIGEST);
  }
});

test("ignores unknown additive fields", async () => {
  const result = await classifyPublishPrepareManifestEvidence({
    ...goldenPayload,
    futureEvidence: "ignored",
    declaredManifest: {
      ...goldenManifest,
      futureManifestField: { ignored: true },
      files: goldenManifest.files.map((file) => ({ ...file, futureFileField: "ignored" })),
    },
  });

  assert.deepEqual(result, {
    mode: "declared_v1",
    evidence: {
      manifestSchemaVersion: 1,
      declaredManifestDigest: GOLDEN_MANIFEST_DIGEST,
      declaredManifest: goldenManifest,
      serializedManifest: GOLDEN_SERIALIZED_MANIFEST,
    },
  });
});

test("classifies every partial field combination before validating values", async () => {
  const cases = [
    [["manifestSchemaVersion"], { manifestSchemaVersion: 1 }],
    [["declaredManifestDigest"], { declaredManifestDigest: GOLDEN_MANIFEST_DIGEST }],
    [["declaredManifest"], { declaredManifest: goldenManifest }],
    [["manifestSchemaVersion", "declaredManifestDigest"], { manifestSchemaVersion: 1, declaredManifestDigest: GOLDEN_MANIFEST_DIGEST }],
    [["manifestSchemaVersion", "declaredManifest"], { manifestSchemaVersion: 1, declaredManifest: goldenManifest }],
    [["declaredManifestDigest", "declaredManifest"], { declaredManifestDigest: GOLDEN_MANIFEST_DIGEST, declaredManifest: goldenManifest }],
  ] as const;

  for (const [presentFields, input] of cases) {
    assert.deepEqual(await classifyPublishPrepareManifestEvidence(input), {
      mode: "partial",
      presentFields,
      missingFields: ["manifestSchemaVersion", "declaredManifestDigest", "declaredManifest"].filter(
        (field) => !presentFields.includes(field as (typeof presentFields)[number]),
      ),
    });
  }
});

test("classifies invalid top-level schema values", async () => {
  for (const manifestSchemaVersion of ["1", null, true]) {
    assert.deepEqual(await classifyPublishPrepareManifestEvidence({ ...goldenPayload, manifestSchemaVersion }), {
      mode: "invalid",
      field: "manifestSchemaVersion",
      reason: "invalid_type",
    });
  }

  for (const manifestSchemaVersion of [0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(await classifyPublishPrepareManifestEvidence({ ...goldenPayload, manifestSchemaVersion }), {
      mode: "invalid",
      field: "manifestSchemaVersion",
      reason: "invalid_value",
    });
  }
});

test("classifies positive supported-range schemas other than v1 as unsupported", async () => {
  for (const manifestSchemaVersion of [2, 999]) {
    assert.deepEqual(await classifyPublishPrepareManifestEvidence({ ...goldenPayload, manifestSchemaVersion }), {
      mode: "unsupported_schema",
      manifestSchemaVersion,
    });
  }
});

test("classifies malformed declared digests", async () => {
  for (const declaredManifestDigest of [
    "a".repeat(63),
    "a".repeat(65),
    GOLDEN_MANIFEST_DIGEST.toUpperCase(),
    `${"a".repeat(63)}g`,
    `${"a".repeat(63)} `,
    `sha256:${GOLDEN_MANIFEST_DIGEST}`,
  ]) {
    assert.deepEqual(await classifyPublishPrepareManifestEvidence({ ...goldenPayload, declaredManifestDigest }), {
      mode: "invalid",
      field: "declaredManifestDigest",
      reason: "invalid_format",
    });
  }

  assert.deepEqual(await classifyPublishPrepareManifestEvidence({ ...goldenPayload, declaredManifestDigest: null }), {
    mode: "invalid",
    field: "declaredManifestDigest",
    reason: "invalid_type",
  });
});

test("classifies invalid manifest shapes without exposing internal details", async () => {
  for (const declaredManifest of [
    null,
    [],
    "manifest",
    {},
    { schemaVersion: 1, entryPoint: "index.html", files: {} },
    { schemaVersion: 1, files: [] },
    { schemaVersion: 1, entryPoint: "INDEX.HTML", files: [] },
    { schemaVersion: 2, entryPoint: "index.html", files: [] },
  ]) {
    const result = await classifyPublishPrepareManifestEvidence({ ...goldenPayload, declaredManifest });
    assert.equal(result.mode, "invalid");
    if (result.mode === "invalid") {
      assert.equal(result.reason, "invalid_manifest");
      assert.ok([
        "declaredManifest",
        "declaredManifest.schemaVersion",
        "declaredManifest.entryPoint",
        "declaredManifest.files",
      ].includes(result.field));
    }
    assert.equal(JSON.stringify(result).includes("INVALID_"), false);
    assert.equal(JSON.stringify(result).includes("index.html"), false);
  }
});

test("maps existing manifest validation failures to safe invalid_manifest results", async () => {
  const invalidManifests = [
    { schemaVersion: 1, entryPoint: "index.html", files: [goldenManifest.files[0]] },
    { schemaVersion: 1, entryPoint: "index.html", files: [goldenManifest.files[2], { ...goldenManifest.files[2], path: "INDEX.html" }] },
    { schemaVersion: 1, entryPoint: "index.html", files: [{ ...goldenManifest.files[2], path: "../index.html" }] },
    { schemaVersion: 1, entryPoint: "index.html", files: [{ ...goldenManifest.files[2], sizeBytes: -1 }] },
    { schemaVersion: 1, entryPoint: "index.html", files: [{ ...goldenManifest.files[2], sha256: "g".repeat(64) }] },
  ];

  for (const declaredManifest of invalidManifests) {
    assert.deepEqual(await classifyPublishPrepareManifestEvidence({ ...goldenPayload, declaredManifest }), {
      mode: "invalid",
      field: "declaredManifest.files",
      reason: "invalid_manifest",
    });
  }
});

test("returns digest_mismatch for a valid manifest with a different digest", async () => {
  assert.deepEqual(await classifyPublishPrepareManifestEvidence({
    ...goldenPayload,
    declaredManifestDigest: "f".repeat(64),
  }), { mode: "digest_mismatch" });
});

test("detects metadata tampering even when the submitted digest is unchanged", async () => {
  const changes = [
    { path: "assets/main.js" },
    { sizeBytes: 16 },
    { contentType: "application/javascript" },
    { sha256: "a".repeat(64) },
  ];

  for (const change of changes) {
    const declaredManifest = {
      ...goldenManifest,
      files: goldenManifest.files.map((file) => file.path === "assets/app.js" ? { ...file, ...change } : file),
    };
    assert.deepEqual(await classifyPublishPrepareManifestEvidence({ ...goldenPayload, declaredManifest }), {
      mode: "digest_mismatch",
    });
  }
});

test("classifies non-object payloads as invalid payload type", async () => {
  for (const value of [null, [], "", 1, new Date()]) {
    assert.deepEqual(await classifyPublishPrepareManifestEvidence(value), {
      mode: "invalid",
      field: "payload",
      reason: "invalid_type",
    });
  }
});

test("applies the documented validation precedence", async () => {
  assert.deepEqual(await classifyPublishPrepareManifestEvidence({
    ...goldenPayload,
    manifestSchemaVersion: 2,
    declaredManifestDigest: "invalid",
  }), { mode: "unsupported_schema", manifestSchemaVersion: 2 });

  assert.deepEqual(await classifyPublishPrepareManifestEvidence({
    ...goldenPayload,
    declaredManifestDigest: "invalid",
    declaredManifest: { schemaVersion: 1, entryPoint: "index.html", files: [] },
  }), {
    mode: "invalid",
    field: "declaredManifestDigest",
    reason: "invalid_format",
  });

  assert.deepEqual(await classifyPublishPrepareManifestEvidence({
    ...goldenPayload,
    declaredManifest: { schemaVersion: 1, entryPoint: "index.html", files: [] },
  }), {
    mode: "invalid",
    field: "declaredManifest.files",
    reason: "invalid_manifest",
  });
});
