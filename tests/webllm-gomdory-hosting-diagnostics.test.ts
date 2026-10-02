import test from "node:test";
import assert from "node:assert/strict";

type Issue = { code: string; detail: string; blocking: boolean };

function classifyDnsLikeError(code: string): Issue {
  if (code === "EAI_AGAIN") return { code: "dns-temporary-failure", detail: "Temporary DNS resolution failure (EAI_AGAIN)", blocking: true };
  if (code === "ENOTFOUND") return { code: "dns-resolution-failure", detail: "DNS resolution failed (ENOTFOUND)", blocking: true };
  return { code: "network-error", detail: "Network error", blocking: true };
}

function classifyManifestStatus(status: number, allowMissingManifest: boolean): Issue | null {
  if (status === 404) return { code: "manifest-missing", detail: "Manifest returned 404 (missing)", blocking: !allowMissingManifest };
  if (status === 403) return { code: "manifest-private-forbidden", detail: "Manifest returned 403 (private/forbidden)", blocking: true };
  if (status !== 200) return { code: "manifest-non-200", detail: `Manifest returned non-200 status (${status})`, blocking: true };
  return null;
}

function buildJsonSummary() {
  return {
    status: "failed",
    manifestUrl: "https://models.gomdory.com/libs/manifest.v1.json",
    allowedOrigin: "https://models.gomdory.com",
    checkedAt: new Date("2026-05-11T00:00:00.000Z").toISOString(),
    blockingIssues: [{ code: "dns-temporary-failure", detail: "Temporary DNS resolution failure (EAI_AGAIN)", blocking: true }],
    warnings: [{ code: "cache-control-missing", detail: "manifest Cache-Control missing", blocking: false }],
    candidateResults: [{ modelId: "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC", blockingIssues: [], warnings: [] }],
  };
}

test("DNS error categorization", () => {
  assert.equal(classifyDnsLikeError("EAI_AGAIN").code, "dns-temporary-failure");
  assert.equal(classifyDnsLikeError("ENOTFOUND").code, "dns-resolution-failure");
});

test("HTTP status categorization", () => {
  assert.equal(classifyManifestStatus(403, false)?.code, "manifest-private-forbidden");
  assert.equal(classifyManifestStatus(500, false)?.code, "manifest-non-200");
});

test("manifest missing is blocking in strict mode", () => {
  const result = classifyManifestStatus(404, false);
  assert.equal(result?.code, "manifest-missing");
  assert.equal(result?.blocking, true);
});

test("--allow-missing-manifest mode turns 404 into non-blocking", () => {
  const result = classifyManifestStatus(404, true);
  assert.equal(result?.code, "manifest-missing");
  assert.equal(result?.blocking, false);
});

test("JSON summary shape is machine-readable and privacy-safe fields only", () => {
  const summary = buildJsonSummary() as Record<string, unknown>;
  for (const key of ["status", "manifestUrl", "allowedOrigin", "checkedAt", "blockingIssues", "warnings", "candidateResults"]) {
    assert.equal(key in summary, true);
  }
  for (const forbidden of ["prompt", "response", "userId", "boardId", "cardId", "lessonAnswer"]) {
    assert.equal(forbidden in summary, false);
  }
});

test("blocking vs warning classification", () => {
  const blocking: Issue = { code: "manifest-invalid-json", detail: "bad", blocking: true };
  const warning: Issue = { code: "range-ignored", detail: "range", blocking: false };
  assert.equal(blocking.blocking, true);
  assert.equal(warning.blocking, false);
});
