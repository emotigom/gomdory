import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  GRANDFATHERED_NON_OPS_WITH_OPS_EXCEPTIONS,
  type GrandfatheredWithOpsCategory,
  type GrandfatheredWithOpsDisposition,
} from "@/lib/ops/withOpsGrandfathered";

import { formatSeamTriageGuide } from "./seam-triage";

const repoRoot = process.cwd();
const appApiRoot = path.join(repoRoot, "app/api");
const requestContextImportPath = "@/lib/ops/requestContext";
const canonicalRequestContextImportPath = "@/lib/api/server/requestContext";
const canonicalOperationalRouteImportPath = "@/lib/api/server/operationalRoute";
const grandfatheredRegistryPath = "lib/ops/withOpsGrandfathered.ts";
const compatibilityShimPath = "lib/ops/requestContext.ts";
const plumbingSymbols = [
  "withRequestContext",
  "type RequestContext",
  "getOrCreateRequestId",
  "applyRequestContextHeaders",
] as const;
const allowedExceptionCategories: readonly GrandfatheredWithOpsCategory[] = [
  "response-shape-sensitive",
  "telemetry-sensitive",
  "route-specific-complexity",
] as const;
const allowedExceptionDispositions: readonly GrandfatheredWithOpsDisposition[] = [
  "hold-for-now",
  "candidate-after-proof",
] as const;
const expectedCompatibilityShimExports = [
  "RequestContext",
  "applyRequestContextHeaders",
  "getOrCreateRequestId",
  "withRequestContext",
  "LogWithContextInput",
  "logWithContext",
] as const;

const REQUEST_CONTEXT_BOUNDARY_SSOT = [
  "docs/OPS_RUNTIME_SURFACE.md",
  "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
  "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
  "tests/README.md",
] as const;

function collectFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
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

test("withOps registry tracks runtime imports only", () => {
  const importPath = "@/lib/ops/withOps";

  assert.equal(importsRuntimeValue(`import type { WithOpsContext } from "${importPath}";`, importPath), false);
  assert.equal(importsRuntimeValue(`import { type WithOpsContext } from "${importPath}";`, importPath), false);
  assert.equal(importsRuntimeValue(`import { withOps, type WithOpsContext } from "${importPath}";`, importPath), true);
});

test("request-context plumbing stays owned by lib/api/server/requestContext", () => {
  const files = collectFiles(appApiRoot);
  const violations: string[] = [];

  for (const absPath of files) {
    const relativePath = path
      .relative(repoRoot, absPath)
      .split(path.sep)
      .join("/");
    const source = fs.readFileSync(absPath, "utf8");

    if (!source.includes(requestContextImportPath)) continue;

    const usesPlumbing = plumbingSymbols.some((symbol) =>
      source.includes(symbol),
    );
    if (usesPlumbing) {
      violations.push(
        `${relativePath}: import request-context plumbing from ${canonicalRequestContextImportPath} and keep ${requestContextImportPath} for compatibility only.`,
      );
    }
  }

  const withOpsSource = fs.readFileSync(
    path.join(repoRoot, "lib/ops/withOps.ts"),
    "utf8",
  );
  if (!withOpsSource.includes(canonicalOperationalRouteImportPath)) {
    violations.push(
      "lib/ops/withOps.ts: delegate shared request-aware route plumbing to @/lib/api/server/operationalRoute.",
    );
  }

  if (!withOpsSource.includes("ops telemetry/error reporting")) {
    violations.push(
      "lib/ops/withOps.ts: document that it is the ops-specific adapter layered over canonical server plumbing.",
    );
  }

  if (
    !withOpsSource.includes(
      "Generic routes should prefer `withRequestContext` + `operationalRoute` instead of defaulting to `withOps`.",
    )
  ) {
    violations.push(
      "lib/ops/withOps.ts: document that generic routes should start with requestContext + operationalRoute unless ops telemetry/error reporting is part of the contract.",
    );
  }

  if (!withOpsSource.includes(grandfatheredRegistryPath)) {
    violations.push(
      `lib/ops/withOps.ts: point contributors to ${grandfatheredRegistryPath} so remaining non-ops exceptions stay explicit instead of implicit precedent.`,
    );
  }

  const compatibilityShimSource = fs.readFileSync(
    path.join(repoRoot, compatibilityShimPath),
    "utf8",
  );
  const compatibilityShimExports = [
    ...compatibilityShimSource.matchAll(/export\s+(?:type|const)\s+([A-Za-z0-9_]+)/g),
  ].map((match) => match[1]);

  assert.deepEqual(
    compatibilityShimExports.sort(),
    [...expectedCompatibilityShimExports].sort(),
    `${compatibilityShimPath}: compatibility shim exports should stay bounded to the documented rollback-safe aliases.`,
  );

  const compatibilityRequiredSnippets = [
    'from "@/lib/api/server/requestContext"',
    'from "@/lib/ops/logWithContext"',
    "Compatibility shim for older ops-facing imports.",
    "Canonical owner:",
    "Keep this module rollback-safe, but do not use it for new imports.",
    "@deprecated Import `RequestContext` from `@/lib/api/server/requestContext` instead.",
    "@deprecated Import `LogWithContextInput` from `@/lib/ops/logWithContext` instead.",
  ] as const;

  for (const snippet of compatibilityRequiredSnippets) {
    if (!compatibilityShimSource.includes(snippet)) {
      violations.push(
        `${compatibilityShimPath}: restore compatibility-only guidance and canonical-owner pointers for '${snippet}'.`,
      );
    }
  }

  if (compatibilityShimSource.includes("export function ")) {
    violations.push(
      `${compatibilityShimPath}: compatibility shim should stay alias-only; move new helper implementations into the canonical owner modules instead.`,
    );
  }

  const seenPaths = new Set<string>();
  const duplicatePaths = new Set<string>();
  for (const entry of GRANDFATHERED_NON_OPS_WITH_OPS_EXCEPTIONS) {
    if (seenPaths.has(entry.path)) {
      duplicatePaths.add(entry.path);
    }
    seenPaths.add(entry.path);

    if (!allowedExceptionCategories.includes(entry.category)) {
      violations.push(
        `${grandfatheredRegistryPath}: ${entry.path} uses an unknown category '${entry.category}'.`,
      );
    }

    if (!allowedExceptionDispositions.includes(entry.disposition)) {
      violations.push(
        `${grandfatheredRegistryPath}: ${entry.path} uses an unknown disposition '${entry.disposition}'.`,
      );
    }

    if (!entry.keepReason.trim()) {
      violations.push(
        `${grandfatheredRegistryPath}: ${entry.path} is missing a keepReason.`,
      );
    }

    if (!entry.migrationPrerequisite.trim()) {
      violations.push(
        `${grandfatheredRegistryPath}: ${entry.path} is missing a migrationPrerequisite note.`,
      );
    }

    if (!entry.doNotCopy.trim()) {
      violations.push(
        `${grandfatheredRegistryPath}: ${entry.path} is missing a doNotCopy note.`,
      );
    }

    const absPath = path.join(repoRoot, entry.path);
    if (!fs.existsSync(absPath)) {
      violations.push(
        `${grandfatheredRegistryPath}: ${entry.path} does not exist.`,
      );
      continue;
    }

    const routeSource = fs.readFileSync(absPath, "utf8");
    if (!routeSource.includes("withOps(")) {
      violations.push(
        `${grandfatheredRegistryPath}: ${entry.path} no longer uses withOps and should be removed from the registry.`,
      );
    }

    if (entry.path.startsWith("app/api/v1/ops/")) {
      violations.push(
        `${grandfatheredRegistryPath}: ${entry.path} is an ops route and should not be tracked as a non-ops exception.`,
      );
    }
  }

  if (duplicatePaths.size > 0) {
    violations.push(
      `${grandfatheredRegistryPath}: duplicate route entries found for ${[...duplicatePaths].sort().join(", ")}.`,
    );
  }

  const actualNonOpsWithOpsImports = files
    .map((absPath) => ({
      relativePath: path.relative(repoRoot, absPath).split(path.sep).join("/"),
      source: fs.readFileSync(absPath, "utf8"),
    }))
    .filter(
      ({ relativePath, source }) =>
        relativePath.startsWith("app/api/v1/") &&
        !relativePath.startsWith("app/api/v1/ops/") &&
        importsRuntimeValue(source, "@/lib/ops/withOps"),
    )
    .map(({ relativePath }) => relativePath)
    .sort();
  const registryPaths = GRANDFATHERED_NON_OPS_WITH_OPS_EXCEPTIONS.map(
    (entry) => entry.path,
  ).sort();

  assert.deepEqual(
    actualNonOpsWithOpsImports,
    registryPaths,
    [
      `${grandfatheredRegistryPath}: keep the explicit non-ops withOps registry in lockstep with actual imports.`,
      "Actual non-ops imports:",
      ...actualNonOpsWithOpsImports,
      "Registry paths:",
      ...registryPaths,
    ].join("\n"),
  );

  assert.equal(
    violations.length,
    0,
    formatSeamTriageGuide({
      seam: "Ops / runtime surface",
      summary:
        "Canonical request-id/request-context plumbing belongs in lib/api/server/requestContext.ts, shared request-aware envelopes belong in lib/api/server/operationalRoute.ts, ops structured logging belongs in lib/ops/logWithContext.ts, and lib/ops/requestContext.ts remains compatibility-only. The non-ops withOps exception list stays explicit in lib/ops/withOpsGrandfathered.ts.",
      sourceOfTruth: REQUEST_CONTEXT_BOUNDARY_SSOT,
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
      violations,
    }),
  );
});
