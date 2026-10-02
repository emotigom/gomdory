import {
  parseMetaverseMissionRewardHookInput,
  parseMetaverseMissionRewardHookResolved,
  type MetaverseInventoryUpdatePlaceholder,
  type MetaverseMissionRewardHookInput,
  type MetaverseMissionRewardHookPort,
  type MetaverseRewardPlaceholderStatus,
} from "@/lib/world-hub/rewards/contracts";

function resolveRewardStatus(status: MetaverseMissionRewardHookInput["completion"]["status"]): MetaverseRewardPlaceholderStatus {
  if (status === "completed") {
    return "placeholder";
  }

  if (status === "failed") {
    return "unavailable";
  }

  return "pending";
}

function createInventoryUpdates(args: {
  missionId: string;
  missionTitle: string;
  returnLabel: string;
  status: MetaverseRewardPlaceholderStatus;
}): MetaverseInventoryUpdatePlaceholder[] {
  return [
    {
      id: `${args.missionId}-inventory-ledger`,
      target: "mission-ledger",
      label: `${args.missionTitle} completion ledger entry`,
      detail: "Placeholder mission history entry for a future Supabase-backed reward ledger seam.",
      quantity: 1,
      status: args.status,
    },
    {
      id: `${args.missionId}-inventory-badge`,
      target: "profile-inventory",
      label: `${args.missionTitle} reward inventory stub`,
      detail: "Placeholder inventory update for future profile/badge integration without mutating core profile systems today.",
      quantity: 1,
      status: args.status,
    },
    {
      id: `${args.missionId}-inventory-return`,
      target: "classroom-report",
      label: args.returnLabel,
      detail: "Placeholder classroom/reporting handoff that keeps reward acknowledgement aligned with the world-hub return path.",
      quantity: null,
      status: args.status === "unavailable" ? "unavailable" : args.status === "placeholder" ? "placeholder" : "pending",
    },
  ];
}

export function resolveDeterministicMissionRewardSummary(args: MetaverseMissionRewardHookInput & { now?: Date }) {
  const input = parseMetaverseMissionRewardHookInput(args);
  const status = resolveRewardStatus(input.completion.status);
  const inventoryUpdates = createInventoryUpdates({
    missionId: input.missionId,
    missionTitle: input.missionTitle,
    returnLabel: input.returnLabel,
    status,
  });
  const highlightedRewardLabel = inventoryUpdates[0]?.label ?? null;
  const emittedAtIso = (args.now ?? new Date()).toISOString();

  return parseMetaverseMissionRewardHookResolved({
    status,
    summary: {
      label:
        status === "placeholder"
          ? `${inventoryUpdates.length} reward placeholders ready`
          : status === "pending"
            ? "Reward summary pending mission completion"
            : "Reward placeholders unavailable",
      detail:
        status === "placeholder"
          ? "Deterministic local reward resolution produced a stable placeholder summary for the world hub, inventory, and future reward services."
          : status === "pending"
            ? "Reward and inventory placeholders remain stable but inactive until mission completion reaches a terminal success state."
            : "Reward issuance remains unavailable for failed mission outcomes until a richer policy and authoritative service seam is connected.",
      highlightedRewardLabel,
      placeholderCount: inventoryUpdates.length,
      inventoryUpdateCount: inventoryUpdates.filter((update) => update.target !== "classroom-report").length,
    },
    inventoryUpdates,
    source: {
      kind: "deterministic-local",
      label: "Deterministic local reward hook",
      detail:
        input.runtimeAuthority === "edge-worker"
          ? "Reward placeholders were resolved locally while preserving a future swap to an authoritative reward service."
          : "Reward placeholders were resolved entirely in preview-safe local mode.",
      diagnostics: {
        deterministic: true,
        derivedFrom: "mission-completion",
        placeholderCount: inventoryUpdates.length,
        inventoryUpdateCount: inventoryUpdates.filter((update) => update.target !== "classroom-report").length,
        rewardServiceStatus: "placeholder-only",
        inventoryServiceStatus: "placeholder-only",
        emittedAtIso,
      },
    },
    fallback: {
      mode: "deterministic-local",
      reason: input.routeMode === "local-fallback" ? "service-not-configured" : "preview-safe-default",
      label: input.routeMode === "local-fallback" ? "Local reward fallback active" : "Preview-safe reward resolution active",
      detail:
        input.routeMode === "local-fallback"
          ? "The mission resolved reward placeholders without an authoritative service so return flows stay deterministic during fallback bootstraps."
          : "The mission used the default deterministic reward hook so runtime consumers can read stable reward summaries before backend services are added.",
    },
  });
}

export function createDeterministicLocalMissionRewardHookPort(): MetaverseMissionRewardHookPort {
  return {
    async resolveRewardSummary(args) {
      return resolveDeterministicMissionRewardSummary(args);
    },
  };
}
