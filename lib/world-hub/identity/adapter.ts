import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";
import {
  parseMetaverseResolvedIdentitySummary,
  type MetaverseResolvedIdentitySummary,
} from "@/lib/world-hub/identity/contracts";

function joinRewardLabel(summaryLabel: string, highlighted: string | null) {
  return highlighted ? `${summaryLabel} · ${highlighted}` : summaryLabel;
}

export function resolveMetaverseIdentitySummary(args: {
  runtime: WorldHubRuntimeInputs | null;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
  now?: Date;
}): MetaverseResolvedIdentitySummary {
  const resolvedAtIso = (args.now ?? new Date()).toISOString();
  const recentPayload = args.recentMissionResult?.payload ?? null;
  const progress = args.runtime?.progress ?? null;
  const persistedRecent = progress?.recentMissionCompletion ?? null;
  const hasRecentPayload = Boolean(recentPayload);
  const hasPersistedRecent = Boolean(persistedRecent);

  if (!hasRecentPayload && !hasPersistedRecent) {
    return parseMetaverseResolvedIdentitySummary({
      profile: {
        status: "empty",
        title: "Metaverse identity warming up",
        detail: "Complete a mission to project progress into profile and inventory seams.",
        hasCompletedMission: false,
        hasRecentReward: false,
      },
      collectible: {
        status: "empty",
        summaryLabel: "No collectibles projected yet",
        summaryDetail: "Reward hooks remain deterministic placeholders until profile/inventory services are attached.",
        highlightedCollectibleLabel: null,
        collectibleCount: 0,
        inventoryUpdateCount: 0,
      },
      source: {
        kind: "deterministic-local",
        label: "Deterministic identity fallback",
        detail: "No mission result or persisted summary was available, so identity seams stay stable with local defaults.",
        diagnostics: {
          deterministic: true,
          derivedFrom: "deterministic-local-fallback",
          progressSourceKind: progress?.source.kind ?? "not-available",
          rewardSourceKind: "none",
          resolvedAtIso,
        },
      },
      fallback: {
        mode: "deterministic-local",
        reason: progress ? "recent-result-unavailable" : "progress-unavailable",
        label: "Profile/inventory seam is on deterministic fallback",
        detail: "UI consumers can rely on this stable summary while profile and inventory integrations remain replaceable.",
      },
    });
  }

  const missionId = recentPayload?.missionId ?? persistedRecent?.missionId ?? null;
  const missionTitle = recentPayload?.missionTitle ?? persistedRecent?.missionTitle ?? null;
  const completionLabel = recentPayload
    ? `${recentPayload.summary.completionLabel} · ${recentPayload.summary.percentComplete}%`
    : persistedRecent
      ? `${persistedRecent.completionLabel} · ${persistedRecent.percentComplete}%`
      : null;

  const rewardLabel = recentPayload
    ? joinRewardLabel(recentPayload.rewards.summaryLabel, recentPayload.rewards.highlightedRewardLabel)
    : persistedRecent?.rewardSummary
      ? joinRewardLabel(
          persistedRecent.rewardSummary.summaryLabel,
          persistedRecent.rewardSummary.highlightedRewardLabel,
        )
      : null;

  const collectibleCount = recentPayload?.rewards.placeholderCount ?? persistedRecent?.rewardSummary?.placeholderCount ?? 0;
  const inventoryUpdateCount =
    recentPayload?.rewards.inventoryUpdateCount ?? persistedRecent?.rewardSummary?.inventoryUpdateCount ?? 0;

  const hasAuthoritativeSource = hasRecentPayload || progress?.source.kind === "supabase";

  return parseMetaverseResolvedIdentitySummary({
    profile: {
      status: "ready",
      title: missionTitle ? `${missionTitle} logged in your identity seam` : "Metaverse identity ready",
      detail:
        progress?.persistedCompletion?.detail ??
        (missionTitle
          ? `Latest mission progress from ${missionTitle} is projected for profile-facing consumers.`
          : "Latest mission progress is projected for profile-facing consumers."),
      hasCompletedMission: Boolean(missionId),
      hasRecentReward: Boolean(rewardLabel),
      lastMissionId: missionId,
      lastMissionTitle: missionTitle,
      completedAtIso: recentPayload?.completedAtIso ?? persistedRecent?.completedAtIso ?? null,
      completionLabel,
      rewardLabel,
      persistenceLabel: progress?.persistedCompletion?.label ?? null,
    },
    collectible: {
      status: collectibleCount > 0 || inventoryUpdateCount > 0 ? "placeholder" : "empty",
      summaryLabel: recentPayload?.rewards.summaryLabel ?? persistedRecent?.rewardSummary?.summaryLabel ?? "Collectible seam ready",
      summaryDetail:
        recentPayload?.rewards.summaryDetail ??
        persistedRecent?.rewardSummary?.summaryDetail ??
        "Collectible placeholders are resolved from mission progress until a full inventory view is connected.",
      highlightedCollectibleLabel:
        recentPayload?.rewards.highlightedRewardLabel ?? persistedRecent?.rewardSummary?.highlightedRewardLabel ?? null,
      collectibleCount,
      inventoryUpdateCount,
    },
    source: {
      kind: hasAuthoritativeSource ? "resolved-metaverse-summary" : "deterministic-local",
      label: hasRecentPayload ? "Mission return projection" : "Persisted progress projection",
      detail: hasRecentPayload
        ? "Recent mission return payload projected into profile and collectible summary contracts."
        : "Persisted metaverse progress projected into profile and collectible summary contracts.",
      diagnostics: {
        deterministic: !hasAuthoritativeSource,
        derivedFrom: hasRecentPayload ? "recent-mission-result" : "persisted-progress",
        progressSourceKind: progress?.source.kind ?? "not-available",
        rewardSourceKind: hasRecentPayload ? "mission-result" : "progress-snapshot",
        resolvedAtIso,
      },
    },
    fallback: {
      mode: hasAuthoritativeSource ? "authoritative-hybrid" : "deterministic-local",
      reason: hasAuthoritativeSource ? "not-needed" : "profile-not-connected",
      label: hasAuthoritativeSource
        ? "Profile/inventory seam uses projected metaverse summaries"
        : "Profile/inventory seam stays replaceable",
      detail: hasAuthoritativeSource
        ? "Contracts remain stable while full profile, inventory, and collectible surfaces are still pending."
        : "Deterministic projection keeps UI behavior stable without exposing raw reward payloads.",
    },
  });
}
