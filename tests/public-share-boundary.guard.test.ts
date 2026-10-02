import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { formatSeamTriageGuide } from "./seam-triage";

type ResolutionContract = {
  file: string;
  helper: "resolvePublicShareBoard" | "resolvePublicShareWall";
  seam: string;
};

const PUBLIC_SHARE_BOUNDARY_SSOT = [
  "docs/OPS_RUNTIME_SURFACE.md",
  "docs/DEVELOPER_ARCHITECTURE_GUIDE.md",
  "docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md",
  "tests/README.md",
] as const;

const PUBLIC_SHARE_RESOLUTION_CONTRACTS: ResolutionContract[] = [
  {
    file: "app/s/[code]/page.tsx",
    helper: "resolvePublicShareBoard",
    seam: "student board page board resolution",
  },
  {
    file: "app/s/[code]/present/loadPresentData.ts",
    helper: "resolvePublicShareBoard",
    seam: "present snapshot board resolution",
  },
  {
    file: "app/s/[code]/walls/[wallId]/present/page.tsx",
    helper: "resolvePublicShareWall",
    seam: "present page wall resolution",
  },
  {
    file: "app/s/[code]/walls/[wallId]/present/slides/page.tsx",
    helper: "resolvePublicShareWall",
    seam: "present slides wall resolution",
  },
  {
    file: "app/api/v1/share/present-state/route.ts",
    helper: "resolvePublicShareBoard",
    seam: "present follow-state board resolution",
  },
  {
    file: "app/api/v1/share/[code]/feed/route.ts",
    helper: "resolvePublicShareBoard",
    seam: "share feed board resolution",
  },
  {
    file: "app/api/v1/share/[code]/feed/walls/[wallId]/route.ts",
    helper: "resolvePublicShareWall",
    seam: "share wall feed resolution",
  },
  {
    file: "app/api/v1/share/[code]/walls/[wallId]/grid/route.ts",
    helper: "resolvePublicShareWall",
    seam: "share wall grid resolution",
  },
  {
    file: "app/api/v1/share/[code]/cards/[cardId]/route.ts",
    helper: "resolvePublicShareBoard",
    seam: "share card ownership route board resolution",
  },
  {
    file: "app/api/v1/share/[code]/cards/[cardId]/move/route.ts",
    helper: "resolvePublicShareBoard",
    seam: "share card move route board resolution fallback",
  },
  {
    file: "app/api/v1/share/[code]/cards/[cardId]/files/initiate/route.ts",
    helper: "resolvePublicShareBoard",
    seam: "share file initiate board resolution",
  },
  {
    file: "app/api/v1/share/[code]/files/[fileId]/finalize/route.ts",
    helper: "resolvePublicShareBoard",
    seam: "share file finalize board resolution",
  },
  {
    file: "app/api/v1/share/[code]/files/[fileId]/delete/route.ts",
    helper: "resolvePublicShareBoard",
    seam: "share file delete board resolution",
  },
  {
    file: "app/api/v1/share/[code]/walls/[wallId]/cards/route.ts",
    helper: "resolvePublicShareWall",
    seam: "share wall cards route wall resolution",
  },
];

const ALLOWED_DIRECT_BOARD_LOOKUP_OWNERS = new Map<string, string>([
  ["app/s/enter/route.ts", "entry gate verifies share/join codes before public board rendering"],
  ["app/api/v1/share/[code]/ownership/request/route.ts", "ownership request validates share code shape before handoff"],
  [
    "app/api/v1/share/[code]/cards/[cardId]/move/route.ts",
    "route keeps a test seam for injected board lookup while defaulting to resolvePublicShareBoard",
  ],
  [
    "app/api/v1/share/[code]/files/[fileId]/download/route.ts",
    "download route uses a file-specific board lookup flow outside the write-guard seam",
  ],
]);

const PUBLIC_SHARE_MUTATION_GUARD_CONTRACTS = [
  {
    file: "app/api/v1/share/[code]/cards/[cardId]/route.ts",
    guards: ["getPublicShareWriteGuard"],
    seam: "share card patch/delete write guard",
  },
  {
    file: "app/api/v1/share/[code]/cards/[cardId]/move/route.ts",
    guards: ["getPublicShareWriteGuard"],
    seam: "share card move write guard",
  },
  {
    file: "app/api/v1/share/[code]/cards/[cardId]/files/initiate/route.ts",
    guards: ["getPublicShareWriteGuard"],
    seam: "share file initiate write guard",
  },
  {
    file: "app/api/v1/share/[code]/files/[fileId]/finalize/route.ts",
    guards: ["getPublicShareWriteGuard"],
    seam: "share file finalize write guard",
  },
  {
    file: "app/api/v1/share/[code]/files/[fileId]/delete/route.ts",
    guards: ["getPublicShareWriteGuard"],
    seam: "share file delete write guard",
  },
  {
    file: "app/api/v1/share/[code]/walls/[wallId]/cards/route.ts",
    guards: ["getPublicShareWriteGuard", "getPublicWallWriteGuard"],
    seam: "share wall card create/list write guard",
  },
] as const;

const read = (file: string) => fs.readFileSync(file, "utf8");

const publicShareTriage = (summary: string, violations: string[]) =>
  formatSeamTriageGuide({
    seam: "Public share / public-entry",
    summary,
    sourceOfTruth: PUBLIC_SHARE_BOUNDARY_SSOT,
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
    violations,
  });

test("public-entry owners keep board and wall resolution centralized in lib/share/public/access", () => {
  const violations: string[] = [];

  for (const contract of PUBLIC_SHARE_RESOLUTION_CONTRACTS) {
    const source = read(contract.file);

    if (!source.includes('from "@/lib/share/public/access"')) {
      violations.push(`${contract.file}: missing lib/share/public/access import for ${contract.seam}`);
      continue;
    }

    if (!source.includes(contract.helper)) {
      violations.push(`${contract.file}: missing ${contract.helper} usage for ${contract.seam}`);
    }
  }

  assert.equal(
    violations.length,
    0,
    publicShareTriage(
      "Board/wall resolution for public share and public-entry routes/pages should stay centralized in lib/share/public/access.",
      violations,
    ),
  );
});

test("direct board lookup primitives remain confined to the few documented public-share exceptions", () => {
  const candidateFiles = [
    ...PUBLIC_SHARE_RESOLUTION_CONTRACTS.map((contract) => contract.file),
    ...ALLOWED_DIRECT_BOARD_LOOKUP_OWNERS.keys(),
  ];

  const violations: string[] = [];

  for (const file of candidateFiles) {
    const source = read(file);
    const usesDirectBoardLookup =
      source.includes("getBoardByShareCode") ||
      source.includes("normalizeShareCode") ||
      source.includes("isValidShareCode");

    if (!usesDirectBoardLookup) {
      continue;
    }

    if (!ALLOWED_DIRECT_BOARD_LOOKUP_OWNERS.has(file)) {
      violations.push(`${file}: unexpected direct share lookup primitive; use lib/share/public/access instead`);
    }
  }

  const allowedExceptions = Array.from(ALLOWED_DIRECT_BOARD_LOOKUP_OWNERS.entries()).map(
    ([file, reason]) => `${file}: ${reason}`,
  );

  assert.equal(
    violations.length,
    0,
    publicShareTriage(
      `Direct share-code lookup primitives should stay confined to the documented exception list. Allowed exceptions: ${allowedExceptions.join("; ")}`,
      violations,
    ),
  );
});

test("public-share mutation routes keep centralized board and wall write guards", () => {
  const violations: string[] = [];

  for (const contract of PUBLIC_SHARE_MUTATION_GUARD_CONTRACTS) {
    const source = read(contract.file);

    if (!source.includes('from "@/lib/share/public/access"')) {
      violations.push(`${contract.file}: missing lib/share/public/access import for ${contract.seam}`);
      continue;
    }

    for (const guard of contract.guards) {
      if (!source.includes(guard)) {
        violations.push(`${contract.file}: missing ${guard} for ${contract.seam}`);
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    publicShareTriage(
      "Mutation routes should keep public share board/wall write decisions delegated to lib/share/public/access instead of re-implementing guard logic inline.",
      violations,
    ),
  );
});
