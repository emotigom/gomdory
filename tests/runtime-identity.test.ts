import assert from "node:assert/strict";
import test from "node:test";

import { readRuntimeIdentity } from "@/lib/env/runtimeIdentity";

test("runtime identity prefers explicit version env strings over Cloudflare metadata", () => {
  const identity = readRuntimeIdentity({
    VERSION_ID: "release-123",
    CF_VERSION_METADATA: { id: "cf-version-456" },
    ENV_NAME: "production",
    BUILD_ID: "build-789",
  });

  assert.deepEqual(identity, {
    buildId: "build-789",
    versionId: "release-123",
    envName: "production",
  });
});

test("runtime identity falls back to Cloudflare version metadata id", () => {
  const identity = readRuntimeIdentity({
    CF_VERSION_METADATA: { id: "cf-version-456" },
  });

  assert.equal(identity.versionId, "cf-version-456");
  assert.equal(identity.buildId, null);
  assert.equal(identity.envName, "unknown");
});

test("runtime identity ignores malformed Cloudflare version metadata", () => {
  const identity = readRuntimeIdentity({
    CF_VERSION_METADATA: { id: "   " },
  });

  assert.equal(identity.versionId, null);
});
