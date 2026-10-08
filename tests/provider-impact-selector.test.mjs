import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyProviderImpact,
  githubOutputLines,
} from "../scripts/ci/select-provider-build.mjs";
import {
  planCloudflareBranchBuild,
} from "../scripts/ci/cloudflare-branch-build-plan.mjs";

test("provider impact skips docs, tests, markdown, and styles without provider work", () => {
  const result = classifyProviderImpact([
    "docs/DEPLOY_NOTES.md",
    "tests/example.test.ts",
    "app/globals.css",
    "README.md",
  ]);

  assert.equal(result.decision, "not-required");
  assert.equal(result.needsCloudflarePackage, false);
  assert.equal(result.reason, "all-changes-provider-neutral");
  assert.deepEqual(result.required, []);
  assert.deepEqual(result.uncertain, []);
});

test("provider impact requires direct Cloudflare and build authority changes", () => {
  for (const file of [
    "wrangler.jsonc",
    "open-next.config.ts",
    "next.config.ts",
    "package.json",
    "middleware.ts",
    "worker/realtime/index.ts",
    "lib/cloudflare/getCloudflareRuntimeEnv.ts",
    "lib/env/runtimeIdentity.ts",
    "scripts/cf/validate-wrangler-bindings.mjs",
    ".github/workflows/ci-preflight.yml",
  ]) {
    const result = classifyProviderImpact([file]);
    assert.equal(result.decision, "required", file);
    assert.equal(result.needsCloudflarePackage, true, file);
    assert.deepEqual(result.required, [file], file);
  }
});

test("provider impact is fail-closed for ordinary runtime or unclassified source", () => {
  for (const file of [
    "app/s/[code]/page.tsx",
    "lib/student/boardModel.ts",
    "scripts/some-new-tool.mjs",
    "unknown/provider-adjacent.file",
  ]) {
    const result = classifyProviderImpact([file]);
    assert.equal(result.decision, "uncertain", file);
    assert.equal(result.needsCloudflarePackage, true, file);
    assert.deepEqual(result.uncertain, [file], file);
  }
});

test("direct provider authority wins over neutral and uncertain paths", () => {
  const result = classifyProviderImpact([
    "docs/README.md",
    "app/page.tsx",
    "wrangler.preview.jsonc",
  ]);

  assert.equal(result.decision, "required");
  assert.equal(result.needsCloudflarePackage, true);
  assert.deepEqual(result.required, ["wrangler.preview.jsonc"]);
  assert.deepEqual(result.neutral, ["docs/README.md"]);
  assert.deepEqual(result.uncertain, ["app/page.tsx"]);
});

test("provider impact normalizes Windows paths and de-duplicates inputs", () => {
  const result = classifyProviderImpact([
    "tests\\provider-impact-selector.test.mjs",
    ".\\tests\\provider-impact-selector.test.mjs",
  ]);

  assert.equal(result.decision, "not-required");
  assert.equal(result.needsCloudflarePackage, false);
  assert.deepEqual(result.paths, ["tests/provider-impact-selector.test.mjs"]);
});

test("provider impact rejects an empty selection instead of silently skipping", () => {
  assert.throws(
    () => classifyProviderImpact(["", "  "]),
    /requires at least one changed path/,
  );
});

test("provider impact exposes stable GitHub outputs", () => {
  const result = classifyProviderImpact(["docs/README.md"]);
  assert.deepEqual(githubOutputLines(result), [
    "provider_impact_decision=not-required",
    "needs_cloudflare_package=false",
    "provider_impact_reason=all-changes-provider-neutral",
  ]);
});

test("PR Core keeps provider selection and refinement in one job without another graph walk", () => {
  const workflow = readFileSync(".github/workflows/ci-preflight.yml", "utf8");
  const classifyAt = workflow.indexOf("Classify Cloudflare provider impact");
  const installAt = workflow.indexOf("Install dependencies when scope or selected checks require them");
  const executeAt = workflow.indexOf("Execute selected architecture PR-fast checks");
  const refineAt = workflow.indexOf("Refine Cloudflare provider impact from existing dependency analysis");

  assert.ok(classifyAt >= 0, "provider impact selector step must exist");
  assert.ok(installAt > classifyAt, "provider impact selection must happen before dependency installation");
  assert.ok(executeAt > installAt, "existing dependency impact must remain after the single install");
  assert.ok(refineAt > executeAt, "refinement must consume the already-computed impact artifact");
  assert.match(workflow, /id: provider/);
  assert.match(workflow, /id: provider_refined/);
  assert.match(workflow, /needs_cloudflare_package: \$\{\{ steps\.provider_refined\.outputs\.needs_cloudflare_package \}\}/);
  assert.match(workflow, /--write-impact "\$RUNNER_TEMP\/gom-dependency-impact\.json"/);
  assert.equal((workflow.match(/--impact(?=\s|$)/g) ?? []).length, 1, "dependency impact must be computed exactly once");
  assert.equal((workflow.match(/run: npm ci/g) ?? []).length, 1, "PR Core must keep one dependency install");
  assert.doesNotMatch(workflow, /name:\s+Cloudflare package|npm run build:cloudflare:package/);
  assert.equal((workflow.match(/^  core:\s*$/gm) ?? []).length, 1);
  assert.doesNotMatch(workflow, /^  (?:cloudflare|provider|build):\s*$/gm);
});

test("Cloudflare branch planner skips non-runtime docs and tests", () => {
  const result = planCloudflareBranchBuild({
    changedPaths: [
      "docs/DEPLOY_NOTES.md",
      "tests/example.test.ts",
      "app/example/page.test.mjs",
    ],
  });

  assert.equal(result.action, "skip");
  assert.equal(result.providerDecision, "not-required");
  assert.equal(result.needsCloudflarePackage, false);
  assert.equal(result.reason, "all-changes-non-runtime");
});

test("Cloudflare branch planner keeps provider-neutral runtime output on Next-only compilation", () => {
  const result = planCloudflareBranchBuild({
    changedPaths: ["app/globals.css"],
  });

  assert.equal(result.action, "next-only");
  assert.equal(result.providerDecision, "not-required");
  assert.equal(result.needsCloudflarePackage, false);
  assert.equal(result.reason, "provider-neutral-runtime-output");
});

test("Cloudflare branch planner retains full preview for provider authority and uncertain source", () => {
  for (const [file, decision] of [
    ["wrangler.jsonc", "required"],
    ["app/s/[code]/page.tsx", "uncertain"],
  ]) {
    const result = planCloudflareBranchBuild({ changedPaths: [file] });
    assert.equal(result.action, "full-preview", file);
    assert.equal(result.providerDecision, decision, file);
    assert.equal(result.needsCloudflarePackage, true, file);
  }
});

test("Cloudflare branch planner fails closed when local Git evidence is unavailable", () => {
  const result = planCloudflareBranchBuild({
    changedPaths: [],
    diffReady: false,
    diffReason: "no-local-base-ref",
  });

  assert.equal(result.action, "full-preview");
  assert.equal(result.providerDecision, "uncertain");
  assert.equal(result.needsCloudflarePackage, true);
  assert.equal(result.reason, "no-local-base-ref");
});

test("Cloudflare build.sh leaves main and preview authority unchanged while gating only other branches", () => {
  const build = readFileSync("build.sh", "utf8");
  const planner = readFileSync("scripts/ci/cloudflare-branch-build-plan.mjs", "utf8");

  assert.match(build, /main\)\s+[\s\S]*npm run deploy:prod/);
  assert.match(build, /preview\)\s+[\s\S]*npm run deploy:preview:fast/);
  assert.match(build, /branch_action="\$\(node scripts\/ci\/cloudflare-branch-build-plan\.mjs --action-only\)"/);
  assert.match(build, /skip\)[\s\S]*selected=branch-verification action=skip/);
  assert.match(build, /next-only\)[\s\S]*npm run build:next/);
  assert.match(build, /full-preview\)[\s\S]*npm run deploy:prepare:preview:fast/);
  assert.doesNotMatch(planner, /git", \["fetch"|https:\/\//);
});
