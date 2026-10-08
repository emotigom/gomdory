import assert from "node:assert/strict";
import test from "node:test";

import {
  refineProviderImpact,
  githubOutputLines,
} from "../scripts/ci/refine-provider-impact.mjs";

const client = "app/example/ClientPanel.tsx";
const base = "base-sha";
const head = "head-sha";

const analyzedImpact = (overrides = {}) => ({
  status: "analyzed",
  refs: { base, head },
  seeds: [{ side: "head", path: client, status: "M" }],
  diagnostics: [],
  witnesses: [],
  planningMs: 12.5,
  ...overrides,
});

const stableClientSource = '"use client";\nexport default function ClientPanel() { return null; }\n';

test("refinement preserves required and not-required preliminary decisions without dependency proof", () => {
  const required = refineProviderImpact({
    preliminaryDecision: "required",
    changedPaths: ["wrangler.jsonc"],
    impact: null,
    base,
    head,
  });
  assert.equal(required.decision, "required");
  assert.equal(required.needsCloudflarePackage, true);
  assert.equal(required.reason, "preliminary-required");

  const neutral = refineProviderImpact({
    preliminaryDecision: "not-required",
    changedPaths: ["docs/README.md"],
    impact: null,
    base,
    head,
  });
  assert.equal(neutral.decision, "not-required");
  assert.equal(neutral.needsCloudflarePackage, false);
  assert.equal(neutral.reason, "preliminary-not-required");
});

test("uncertain modified source can downgrade only with a stable client boundary and reused impact", () => {
  const reads = [];
  const result = refineProviderImpact({
    preliminaryDecision: "uncertain",
    changedPaths: [client],
    impact: analyzedImpact(),
    base,
    head,
    readAtRef: (ref, file) => {
      reads.push([ref, file]);
      return stableClientSource;
    },
  });

  assert.equal(result.decision, "not-required");
  assert.equal(result.needsCloudflarePackage, false);
  assert.equal(result.reason, "stable-client-boundary-proven");
  assert.equal(result.proof.stableClientBoundary, true);
  assert.equal(result.proof.reusedDependencyImpact, true);
  assert.deepEqual(result.proof.changedSources, [client]);
  assert.deepEqual(reads, [[base, client], [head, client]]);
});

test("client refinement stays fail-closed when the boundary is not stable across base and head", () => {
  const result = refineProviderImpact({
    preliminaryDecision: "uncertain",
    changedPaths: [client],
    impact: analyzedImpact(),
    base,
    head,
    readAtRef: (ref) => ref === head ? stableClientSource : "export const serverValue = 1;\n",
  });

  assert.equal(result.decision, "uncertain");
  assert.equal(result.needsCloudflarePackage, true);
  assert.equal(result.reason, "stable-use-client-directive-not-proven");
});

test("added, renamed, or deleted client candidates never downgrade", () => {
  for (const seed of [
    { side: "head", path: client, status: "A" },
    { side: "head", path: client, status: "R100" },
    { side: "base", path: client, status: "D" },
  ]) {
    const result = refineProviderImpact({
      preliminaryDecision: "uncertain",
      changedPaths: [client],
      impact: analyzedImpact({ seeds: [seed] }),
      base,
      head,
      readAtRef: () => stableClientSource,
    });

    assert.equal(result.decision, "uncertain", seed.status);
    assert.equal(result.needsCloudflarePackage, true, seed.status);
    assert.equal(result.reason, "client-boundary-change-not-stable-modification", seed.status);
  }
});

test("dependency uncertainty in the changed client source blocks the optimization", () => {
  const result = refineProviderImpact({
    preliminaryDecision: "uncertain",
    changedPaths: [client],
    impact: analyzedImpact({
      diagnostics: [{ side: "head", from: client, kind: "dynamic-import", reason: "non-static-dependency-excluded" }],
    }),
    base,
    head,
    readAtRef: () => stableClientSource,
  });

  assert.equal(result.decision, "uncertain");
  assert.equal(result.needsCloudflarePackage, true);
  assert.equal(result.reason, "changed-client-source-has-dependency-uncertainty");
});

test("missing, stale, or non-analyzed impact evidence fails closed without blocking CI", () => {
  for (const [impact, reason] of [
    [null, "dependency-impact-missing"],
    [{ ...analyzedImpact(), status: "skipped-no-ts-changes" }, "dependency-impact-not-analyzed"],
    [{ ...analyzedImpact(), refs: { base: "wrong", head } }, "dependency-impact-ref-mismatch"],
  ]) {
    const result = refineProviderImpact({
      preliminaryDecision: "uncertain",
      changedPaths: [client],
      impact,
      base,
      head,
      readAtRef: () => stableClientSource,
    });
    assert.equal(result.decision, "uncertain", reason);
    assert.equal(result.needsCloudflarePackage, true, reason);
    assert.equal(result.reason, reason);
  }
});

test("non-TS uncertain source is never treated as a client proof candidate", () => {
  const file = "scripts/runtime-helper.mjs";
  const result = refineProviderImpact({
    preliminaryDecision: "uncertain",
    changedPaths: [file],
    impact: analyzedImpact({ seeds: [] }),
    base,
    head,
  });

  assert.equal(result.decision, "uncertain");
  assert.equal(result.needsCloudflarePackage, true);
  assert.equal(result.reason, "uncertain-source-not-ts-client-candidate");
});

test("neutral test changes may accompany a proven modified client source", () => {
  const testFile = "tests/client-panel.test.ts";
  const result = refineProviderImpact({
    preliminaryDecision: "uncertain",
    changedPaths: [client, testFile],
    impact: analyzedImpact({
      seeds: [
        { side: "head", path: client, status: "M" },
        { side: "head", path: testFile, status: "M" },
      ],
    }),
    base,
    head,
    readAtRef: () => stableClientSource,
  });

  assert.equal(result.decision, "not-required");
  assert.equal(result.needsCloudflarePackage, false);
  assert.deepEqual(result.proof.changedSources, [client]);
});

test("refinement exposes stable GitHub outputs", () => {
  const result = refineProviderImpact({
    preliminaryDecision: "uncertain",
    changedPaths: [client],
    impact: analyzedImpact(),
    base,
    head,
    readAtRef: () => stableClientSource,
  });

  assert.deepEqual(githubOutputLines(result), [
    "provider_impact_decision=not-required",
    "needs_cloudflare_package=false",
    "provider_impact_reason=stable-client-boundary-proven",
  ]);
});
