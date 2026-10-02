import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { formatSeamTriageGuide } from "./seam-triage";
import { api } from "@/lib/standards/routes";
import { apiV1Path } from "@/lib/standards/pathTypes";

type OpsRuntimeRouteContract = {
  file: string;
  seam: string;
  owner: string;
  requiredSnippets: string[];
  forbiddenSnippets?: string[];
};

const OPS_RUNTIME_BOUNDARY_SSOT = [
  "docs/OPS_RUNTIME_SURFACE.md",
  "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
  "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
  "tests/README.md",
] as const;

const HEALTH_API_SEAM = `${apiPathLabel("/api", "health")} proxy delegation`;
const OPS_PING_SEAM = `${String(api.ops.ping())} operational envelope`;
const OPS_RUNTIME_SEAM = `${String(apiV1Path("ops/runtime"))} request-context plumbing`;
const SYSTEM_DIAG_SEAM = `${String(api.system.diag())} runtime summary delegation`;
const E2E_LOGIN_SEAM = `${String(apiV1Path("e2e/login"))} smoke auth + operational envelope`;

function apiPathLabel(...segments: string[]) {
  return segments.join("/");
}

const OPS_RUNTIME_ROUTE_CONTRACTS: OpsRuntimeRouteContract[] = [
  {
    file: "app/api/health/route.ts",
    seam: HEALTH_API_SEAM,
    owner: "lib/ops/healthProxy",
    requiredSnippets: ['from "@/lib/ops/healthProxy"', "return proxyInternalHealthRequest(request);"],
    forbiddenSnippets: ['fetch(new URL("/__health", request.url)', "fetch(healthUrl", "new URL('/__health', request.url)"],
  },
  {
    file: "app/api/v1/ops/ping/route.ts",
    seam: OPS_PING_SEAM,
    owner: "lib/api/server/operational + lib/api/server/requestContext",
    requiredSnippets: [
      'from "@/lib/api/server/operational"',
      'from "@/lib/api/server/requestContext"',
      "jsonOperationalOk",
      "withRequestContext",
      "export const GET = withRequestContext(handleGet);",
    ],
    forbiddenSnippets: ["NextResponse.json(", "new NextResponse(", "new Response("],
  },
  {
    file: "app/api/v1/ops/runtime/route.ts",
    seam: OPS_RUNTIME_SEAM,
    owner: "lib/api/server/requestContext",
    requiredSnippets: [
      'from "@/lib/api/server/requestContext"',
      "withRequestContext",
      "export const GET = withRequestContext(handleGet);",
    ],
  },
  {
    file: "app/api/v1/system/diag/route.ts",
    seam: SYSTEM_DIAG_SEAM,
    owner: "lib/api/server/operational + lib/api/server/requestContext + lib/system/diag/runtimeSummary",
    requiredSnippets: [
      'from "@/lib/api/server/operational"',
      'from "@/lib/api/server/requestContext"',
      'from "@/lib/system/diag/runtimeSummary"',
      "buildSystemDiagResponse",
      "jsonOperationalOk",
      "jsonOperationalError",
      "export const GET = withRequestContext(handleGet);",
    ],
    forbiddenSnippets: [
      "AwsClient",
      "getRuntimeEnv",
      "createSupabaseAdminClient",
      "createSupabaseServerClient",
      "resolveWebllmConfig",
    ],
  },
  {
    file: "app/api/v1/e2e/login/route.ts",
    seam: E2E_LOGIN_SEAM,
    owner: "lib/e2e/smokeAuth + lib/api/server/operational + lib/api/server/requestContext",
    requiredSnippets: [
      'from "@/lib/api/server/operational"',
      'from "@/lib/e2e/smokeAuth"',
      'from "@/lib/api/server/requestContext"',
      "readE2ESmokeSecretStatus",
      "logE2ESmokeSecretStatus",
      "jsonOperationalOk",
      "jsonOperationalError",
      "export const POST = withRequestContext(handlePost);",
    ],
    forbiddenSnippets: ['readEnvString("E2E_SMOKE_SECRET")', 'headers.get("x-e2e-secret")'],
  },
];

const read = (file: string) => fs.readFileSync(file, "utf8");

test("ops/runtime routes keep helper ownership delegated to the documented seam modules", () => {
  const violations: string[] = [];

  for (const contract of OPS_RUNTIME_ROUTE_CONTRACTS) {
    const source = read(contract.file);

    for (const snippet of contract.requiredSnippets) {
      if (!source.includes(snippet)) {
        violations.push(
          [
            `${contract.file}: missing ${snippet}`,
            `  seam: ${contract.seam}`,
            `  expected owner: ${contract.owner}`,
            "  fix: keep the route thin and restore delegation to the documented helper owner instead of recreating the plumbing inline.",
          ].join("\n"),
        );
      }
    }

    for (const snippet of contract.forbiddenSnippets ?? []) {
      if (source.includes(snippet)) {
        violations.push(
          [
            `${contract.file}: unexpected ${snippet}`,
            `  seam: ${contract.seam}`,
            `  expected owner: ${contract.owner}`,
            "  fix: move the drifted logic back into the owner module and leave only request parsing + delegation in the route.",
          ].join("\n"),
        );
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    formatSeamTriageGuide({
      seam: "Ops / runtime surface",
      summary:
        "Expected owners: lib/ops/healthProxy, lib/api/server/operational, lib/api/server/requestContext, lib/system/diag/runtimeSummary, and lib/e2e/smokeAuth. Request-context plumbing belongs in lib/api/server/requestContext.ts; lib/ops/requestContext.ts is only an ops-facing compatibility/logging shim.",
      sourceOfTruth: OPS_RUNTIME_BOUNDARY_SSOT,
      fastCommands: [
        "npm run validate:seams",
        "npm run test:guards -- --match ops-runtime-boundary,request-context-ownership",
        "npm run test:node -- --match requestContext,withOps,system-diag",
      ],
      docs: [
        "docs/OPS_RUNTIME_SURFACE.md",
        "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
        "tests/README.md",
      ],
      violations,
    }),
  );
});
