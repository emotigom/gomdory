import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { formatSeamTriageGuide } from "./seam-triage";

type StudentExecutionBoundaryContract = {
  file: string;
  seam: string;
  owner: string;
  requiredSnippets: string[];
  forbiddenSnippets?: string[];
};

const STUDENT_EXECUTION_BOUNDARY_SSOT = [
  "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
  "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
  "tests/README.md",
] as const;

const STUDENT_EXECUTION_BOUNDARY_CONTRACTS: StudentExecutionBoundaryContract[] = [
  {
    file: "app/edu/_components/ChatPanel.tsx",
    seam: "student ChatPanel dispatch + provider delegation",
    owner:
      "lib/edu/lesson/studentChatPanelOrchestration.ts + lib/edu/lesson/studentExecutionProviderAvailability.ts",
    requiredSnippets: [
      'from "@/lib/edu/lesson/studentChatPanelOrchestration"',
      'from "@/lib/edu/lesson/studentExecutionProviderAvailability"',
      "createStudentDecorateActionPlan",
      "createStudentCoachActionPlan",
      "recordStudentChatPanelTelemetryEvents(plan.telemetryEvents, shareCode)",
      "resolveStudentProviderAvailability({",
    ],
    forbiddenSnippets: [
      "resolveStudentDecorateDispatchDecision(",
      "resolveStudentCoachDispatchDecision(",
      "resolveStudentExecutionRequestIdOwnership(",
      "resolveStudentExecutionRetryMode(",
    ],
  },
  {
    file: "lib/edu/lesson/studentChatPanelOrchestration.ts",
    seam: "student orchestration action-plan ownership",
    owner: "lib/edu/lesson/studentDecorateExecution.ts + lib/edu/lesson/studentCoachExecution.ts",
    requiredSnippets: [
      'from "@/lib/edu/lesson/studentDecorateExecution"',
      'from "@/lib/edu/lesson/studentCoachExecution"',
      "resolveStudentDecorateDispatchDecision(input)",
      "resolveStudentCoachDispatchDecision(input)",
      "requestIdOwnership: decision.requestIdOwnership",
      "reasonCategory: decision.reasonCategory",
    ],
    forbiddenSnippets: [
      "resolveStudentProviderAvailability(",
      "resolveStudentExecutionRequestIdOwnership(",
      "resolveStudentExecutionRetryMode(",
    ],
  },
  {
    file: "lib/edu/lesson/studentDecorateExecution.ts",
    seam: "student decorate dispatch semantics ownership",
    owner: "lib/edu/lesson/studentExecutionSemantics.ts",
    requiredSnippets: [
      'from "@/lib/edu/lesson/studentExecutionSemantics"',
      "resolveStudentExecutionRequestIdOwnership",
      "requestIdOwnership: resolveStudentExecutionRequestIdOwnership",
    ],
    forbiddenSnippets: ["resolveStudentExecutionRetryMode("],
  },
  {
    file: "lib/edu/lesson/studentCoachExecution.ts",
    seam: "student coach dispatch semantics ownership",
    owner: "lib/edu/lesson/studentExecutionSemantics.ts",
    requiredSnippets: [
      'from "@/lib/edu/lesson/studentExecutionSemantics"',
      "resolveStudentExecutionRequestIdOwnership",
      "resolveStudentExecutionRetryMode",
      "resolveStudentExecutionRetryMode({ source, retrySources: STUDENT_COACH_RETRY_SOURCES })",
    ],
  },
];

const read = (file: string) => fs.readFileSync(file, "utf8");

test("student execution seam keeps ChatPanel, orchestration, provider availability, and semantics owners delegated", () => {
  const violations: string[] = [];

  for (const contract of STUDENT_EXECUTION_BOUNDARY_CONTRACTS) {
    const source = read(contract.file);

    for (const snippet of contract.requiredSnippets) {
      if (!source.includes(snippet)) {
        violations.push(
          [
            `${contract.file}: missing ${snippet}`,
            `  seam: ${contract.seam}`,
            `  expected owner: ${contract.owner}`,
            "  fix: restore delegation to the documented student execution owner instead of rebuilding dispatch/provider semantics inline.",
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
            "  fix: move the drifted logic back to the owner module so this layer stays focused on wiring/delegation.",
          ].join("\n"),
        );
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    formatSeamTriageGuide({
      seam: "Student execution",
      summary:
        "Expected chain: ChatPanel -> studentChatPanelOrchestration -> studentDecorateExecution/studentCoachExecution -> studentExecutionSemantics, with provider readiness routed through studentExecutionProviderAvailability.",
      sourceOfTruth: STUDENT_EXECUTION_BOUNDARY_SSOT,
      fastCommands: [
        "npm run validate:seams",
        "npm run test:guards -- --match student-execution-boundary",
        "npm run test:node -- --match student-execution,student-coach,student-chat-panel-orchestration,decorate-student-surface",
      ],
      docs: [
        "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
        "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
        "tests/README.md",
      ],
      violations,
    }),
  );
});
