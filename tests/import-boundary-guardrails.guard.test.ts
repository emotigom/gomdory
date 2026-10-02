import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  formatGrandfatheredWithOpsExceptionSummary,
  GRANDFATHERED_NON_OPS_WITH_OPS_ROUTE_PATHS,
} from "@/lib/ops/withOpsGrandfathered";

import { formatSeamTriageGuide } from "./seam-triage";

const repoRoot = process.cwd();
const SEARCH_ROOTS = ["app", "lib", "tests"] as const;

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "coverage",
  "dist",
  "template",
]);

type ImportBoundaryPolicy = {
  seam: string;
  importPath: string;
  allowedPrefixes: readonly string[];
  allowedFiles?: readonly string[];
  summary: string;
  sourceOfTruth: readonly string[];
  fastCommands: readonly string[];
  docs: readonly string[];
};

const TARGET_POLICIES: readonly ImportBoundaryPolicy[] = [
  {
    seam: "Public share / public-entry",
    importPath: "@/lib/share/public/access",
    allowedPrefixes: ["app/s/", "app/api/v1/share/", "tests/"],
    summary:
      "lib/share/public/access should stay attached to the public-entry/share layer (app/s/** and app/api/v1/share/**) or dedicated tests.",
    sourceOfTruth: [
      "docs/OPS_RUNTIME_SURFACE.md",
      "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
      "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
      "tests/README.md",
    ],
    fastCommands: [
      "npm run validate:seams",
      "npm run check:route-invariants",
      "npm run test:guards -- --match public-share-boundary",
      "npm run test:node -- --match public-share-access,public-share-boundary,onboarding-demo.route",
    ],
    docs: [
      "docs/OPS_RUNTIME_SURFACE.md",
      "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
      "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
      "tests/README.md",
    ],
  },
  {
    seam: "Ops / runtime surface",
    importPath: "@/lib/e2e/smokeAuth",
    allowedPrefixes: ["app/api/v1/e2e/login/", "tests/"],
    summary:
      "lib/e2e/smokeAuth should stay attached to the /api/v1/e2e/login route boundary or dedicated tests.",
    sourceOfTruth: [
      "docs/OPS_RUNTIME_SURFACE.md",
      "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
      "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
      "tests/README.md",
    ],
    fastCommands: [
      "npm run validate:seams",
      "npm run test:guards -- --match ops-runtime-boundary,request-context-ownership",
      "npm run test:node -- --match requestContext,withOps,system-diag",
    ],
    docs: [
      "docs/OPS_RUNTIME_SURFACE.md",
      "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
      "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
      "tests/README.md",
    ],
  },
  {
    seam: "Ops / runtime surface",
    importPath: "@/lib/system/diag/runtimeSummary",
    allowedPrefixes: ["app/api/v1/system/diag/", "tests/"],
    summary:
      "lib/system/diag/runtimeSummary should stay attached to the /api/v1/system/diag route boundary or dedicated tests.",
    sourceOfTruth: [
      "docs/OPS_RUNTIME_SURFACE.md",
      "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
      "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
      "tests/README.md",
    ],
    fastCommands: [
      "npm run validate:seams",
      "npm run test:guards -- --match ops-runtime-boundary,request-context-ownership",
      "npm run test:node -- --match requestContext,withOps,system-diag",
    ],
    docs: [
      "docs/OPS_RUNTIME_SURFACE.md",
      "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
      "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
      "tests/README.md",
    ],
  },
  {
    seam: "Ops / runtime surface",
    importPath: "@/lib/ops/requestContext",
    allowedPrefixes: ["tests/"],
    summary:
      "lib/ops/requestContext is a compatibility shim only. New imports should use @/lib/api/server/requestContext for request plumbing or @/lib/ops/logWithContext for ops logging.",
    sourceOfTruth: [
      "docs/OPS_RUNTIME_SURFACE.md",
      "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
      "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
      "tests/README.md",
    ],
    fastCommands: [
      "npm run validate:seams",
      "npm run test:guards -- --match ops-runtime-boundary,request-context-ownership",
      "npm run test:node -- --match requestContext,withOps,system-diag",
    ],
    docs: [
      "docs/OPS_RUNTIME_SURFACE.md",
      "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
      "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
      "tests/README.md",
    ],
  },
  {
    seam: "Ops / runtime surface",
    importPath: "@/lib/ops/withOps",
    allowedPrefixes: ["app/api/v1/ops/", "tests/"],
    allowedFiles: GRANDFATHERED_NON_OPS_WITH_OPS_ROUTE_PATHS,
    summary: [
      "lib/ops/withOps is the ops-specific adapter over canonical route plumbing.",
      "New generic routes should start from @/lib/api/server/operationalRoute plus @/lib/api/server/requestContext.",
      "The remaining non-ops imports below are grandfathered exceptions, not precedent, and should not be copied into new routes:",
      formatGrandfatheredWithOpsExceptionSummary(),
    ].join("\n"),
    sourceOfTruth: [
      "docs/OPS_RUNTIME_SURFACE.md",
      "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
      "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
      "tests/README.md",
    ],
    fastCommands: [
      "npm run validate:seams",
      "npm run test:guards -- --match ops-runtime-boundary,request-context-ownership",
      "npm run test:node -- --match requestContext,withOps,system-diag",
    ],
    docs: [
      "docs/OPS_RUNTIME_SURFACE.md",
      "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
      "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
      "tests/README.md",
    ],
  },
];

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const abs = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...collectFiles(abs));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx|mts|cts|js|mjs|cjs)$/i.test(entry.name)) continue;

    out.push(abs);
  }

  return out;
}

function importsRuntimeValue(source: string, importPath: string) {
  const declarations = source.match(/import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?/g) ?? [];

  return declarations.some((declaration) => {
    if (!declaration.includes(importPath)) return false;

    const clause = declaration.slice("import".length, declaration.indexOf("from")).trim();
    const namedTypesOnly = /^\{\s*(?:type\s+\w+(?:\s+as\s+\w+)?\s*,?\s*)*\}$/.test(clause);
    return !clause.startsWith("type ") && !namedTypesOnly;
  });
}

test("route boundary guard ignores type-only imports", () => {
  const importPath = "@/lib/ops/withOps";

  assert.equal(importsRuntimeValue(`import type { WithOpsContext } from "${importPath}";`, importPath), false);
  assert.equal(importsRuntimeValue(`import { type WithOpsContext } from "${importPath}";`, importPath), false);
  assert.equal(importsRuntimeValue(`import { withOps, type WithOpsContext } from "${importPath}";`, importPath), true);
});

test("route-adjacent server helper imports stay inside their documented owners", () => {
  const files = SEARCH_ROOTS.flatMap((root) =>
    collectFiles(path.join(repoRoot, root)),
  );

  for (const policy of TARGET_POLICIES) {
    const violations: string[] = [];

    for (const absPath of files) {
      const relativePath = path
        .relative(repoRoot, absPath)
        .split(path.sep)
        .join("/");
      const source = fs.readFileSync(absPath, "utf8");

      if (!importsRuntimeValue(source, policy.importPath)) continue;

      const allowed =
        policy.allowedPrefixes.some((prefix) =>
          relativePath.startsWith(prefix),
        ) ||
        policy.allowedFiles?.includes(relativePath) ||
        false;

      if (!allowed) {
        violations.push(relativePath);
      }
    }

    assert.equal(
      violations.length,
      0,
      formatSeamTriageGuide({
        seam: policy.seam,
        summary: policy.summary,
        sourceOfTruth: policy.sourceOfTruth,
        fastCommands: policy.fastCommands,
        docs: policy.docs,
        violations,
      }),
    );
  }
});
