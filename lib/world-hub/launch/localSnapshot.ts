import type {
  MetaverseLaunchControlDecision,
  MetaverseLaunchControlMetadata,
  MetaverseMissionLaunchOverride,
} from "@/lib/world-hub/launch/contracts";

type LocalMetaverseLaunchControlSnapshot = {
  key: string;
  sourceLabel: string;
  sourceDetail: string;
  metadata: MetaverseLaunchControlMetadata;
  hubEntry: MetaverseLaunchControlDecision;
  missionOverrides: readonly MetaverseMissionLaunchOverride[];
};

const SNAPSHOT_UPDATED_AT_ISO = "2026-03-22T00:00:00.000Z";

const DEFAULT_OPEN_PREVIEW_SNAPSHOT: LocalMetaverseLaunchControlSnapshot = {
  key: "default-open-preview",
  sourceLabel: "Local preview launch snapshot",
  sourceDetail:
    "Deterministic class-scoped launch controls are currently served from a local preview snapshot so future teacher-managed launch configuration can replace this seam without changing consumers.",
  metadata: {
    state: "open",
    stateLabel: "World hub open",
    summary: "World hub entry is allowed in preview mode and missions inherit their own manifest/policy availability unless a local override exists.",
    updatedAtIso: SNAPSHOT_UPDATED_AT_ISO,
    effectiveFromIso: null,
    expiresAtIso: null,
  },
  hubEntry: {
    status: "allowed",
    code: "preview-allowed",
    label: "World hub entry allowed",
    detail: "No scheduled class launch gate is attached in the deterministic preview snapshot.",
  },
  missionOverrides: [],
};

const LOCAL_SNAPSHOTS_BY_CLASS_ID: Record<string, LocalMetaverseLaunchControlSnapshot> = {
  "class-preview-locked": {
    key: "preview-world-blocked",
    sourceLabel: "Local preview launch snapshot",
    sourceDetail:
      "This snapshot demonstrates a class-scoped world-hub block while teacher launch controls remain a narrow replaceable seam.",
    metadata: {
      state: "blocked",
      stateLabel: "World hub blocked",
      summary: "World hub entry is blocked for this class snapshot, and mission launch should remain closed until a teacher-managed override replaces preview data.",
      updatedAtIso: SNAPSHOT_UPDATED_AT_ISO,
      effectiveFromIso: null,
      expiresAtIso: null,
    },
    hubEntry: {
      status: "blocked",
      code: "teacher-blocked",
      label: "World hub entry blocked",
      detail: "Preview snapshot marks this class scope as closed before students enter the world hub.",
    },
    missionOverrides: [],
  },
  "class-preview-mission-release": {
    key: "preview-mission-release",
    sourceLabel: "Local preview launch snapshot",
    sourceDetail:
      "This snapshot keeps world entry open while exposing focused mission override seams for future moderated release flows.",
    metadata: {
      state: "mission-overrides",
      stateLabel: "Mission-specific release overrides",
      summary: "World hub entry remains open, but a local release snapshot explicitly opens Orbit Lab and blocks Creative Arcade for this class scope.",
      updatedAtIso: SNAPSHOT_UPDATED_AT_ISO,
      effectiveFromIso: null,
      expiresAtIso: null,
    },
    hubEntry: {
      status: "allowed",
      code: "allowed",
      label: "World hub entry allowed",
      detail: "Students can enter the world hub while mission launch stays governed by per-mission overrides.",
    },
    missionOverrides: [
      {
        missionId: "mission-orbit-lab",
        mode: "allowed",
        decision: {
          status: "allowed",
          code: "mission-allowed",
          label: "Mission release open",
          detail: "Orbit Lab is explicitly opened by the local class snapshot.",
        },
        detail: "Preview release override keeps Orbit Lab launchable for this class scope.",
      },
      {
        missionId: "mission-creative-arcade",
        mode: "blocked",
        decision: {
          status: "blocked",
          code: "mission-blocked",
          label: "Mission release blocked",
          detail: "Creative Arcade remains closed in the local class snapshot.",
        },
        detail: "Preview release override keeps Creative Arcade hidden until a future teacher-managed release flow is attached.",
      },
    ],
  },
};

export function getLocalMetaverseLaunchControlSnapshot(classId: string | null) {
  if (!classId) {
    return DEFAULT_OPEN_PREVIEW_SNAPSHOT;
  }

  return LOCAL_SNAPSHOTS_BY_CLASS_ID[classId] ?? DEFAULT_OPEN_PREVIEW_SNAPSHOT;
}
