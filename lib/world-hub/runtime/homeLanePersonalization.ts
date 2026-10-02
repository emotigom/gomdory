import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { MetaverseResolvedIdentitySummary } from "@/lib/world-hub/identity/contracts";
import type { WorldHubHomeZoneState } from "@/lib/world-hub/runtime/homeArrivalFeedback";

export type WorldHubHomeLanePlaceholderSignal = {
  id: string;
  label: string;
  kind: WorldHubRuntimeInputs["homeLane"]["placeholders"][number]["kind"];
  symbol: string;
  accent: string;
  statusLabel: string;
  detail: string;
  projectionValue: string | null;
  emphasis: "quiet" | "soft" | "warm";
  state: "quiet" | "ready";
};

export function resolveWorldHubHomeLanePersonalization(args: {
  runtime: WorldHubRuntimeInputs | null;
  identitySummary: MetaverseResolvedIdentitySummary;
  homeZoneState: WorldHubHomeZoneState;
}): {
  title: string;
  detail: string;
  signals: WorldHubHomeLanePlaceholderSignal[];
  readyCount: number;
} {
  if (!args.runtime) {
    return {
      title: "Home lane keepsakes",
      detail: "Gathering your porch markers…",
      signals: [],
      readyCount: 0,
    };
  }

  const hasCompletedMission = args.identitySummary.profile.hasCompletedMission;
  const hasRecentReward = args.identitySummary.profile.hasRecentReward;
  const rewardLabel = args.identitySummary.profile.rewardLabel;
  const completionLabel = args.identitySummary.profile.completionLabel;
  const highlightedCollectibleLabel = args.identitySummary.collectible.highlightedCollectibleLabel;
  const collectibleCount = args.identitySummary.collectible.collectibleCount;
  const inventoryUpdateCount = args.identitySummary.collectible.inventoryUpdateCount;
  const collectibleProjection =
    collectibleCount > 0
      ? `${collectibleCount} keepsake${collectibleCount === 1 ? "" : "s"}`
      : inventoryUpdateCount > 0
        ? `${inventoryUpdateCount} inventory sync${inventoryUpdateCount === 1 ? "" : "s"}`
        : null;

  const signals = args.runtime.homeLane.placeholders.map<WorldHubHomeLanePlaceholderSignal>((placeholder) => {
    switch (placeholder.kind) {
      case "achievement-display":
      case "recent-achievement":
        return {
          id: placeholder.id,
          label: placeholder.label,
          kind: placeholder.kind,
          symbol: "★",
          accent: "#fbbf24",
          state: hasCompletedMission ? "ready" : "quiet",
          statusLabel: hasCompletedMission ? "Latest trail pinned" : "Awaiting next milestone",
          detail: hasCompletedMission
            ? "Recent mission completion can be framed here as a warm return-memory."
            : "This post quietly waits for your next mission completion.",
          projectionValue: completionLabel,
          emphasis: hasCompletedMission ? "warm" : "quiet",
        };
      case "badge-display":
        return {
          id: placeholder.id,
          label: placeholder.label,
          kind: placeholder.kind,
          symbol: "⬢",
          accent: "#38bdf8",
          state: hasRecentReward ? "ready" : "quiet",
          statusLabel: hasRecentReward ? "Badge ribbon updated" : "Badge ribbon waiting",
          detail: hasRecentReward
            ? "A lightweight badge rail reflects your newest earned marker."
            : "Badge rail remains reserved until a reward seam resolves.",
          projectionValue: rewardLabel,
          emphasis: hasRecentReward ? "soft" : "quiet",
        };
      case "message-hook":
        return {
          id: placeholder.id,
          label: placeholder.label,
          kind: placeholder.kind,
          symbol: "✉",
          accent: "#67e8f9",
          state: args.homeZoneState === "arrived" ? "ready" : "quiet",
          statusLabel: args.homeZoneState === "arrived" ? "Mail hook listening" : "Quiet until you return home",
          detail: "Home arrival notes can surface here without opening a full inbox surface.",
          projectionValue: null,
          emphasis: args.homeZoneState === "arrived" ? "soft" : "quiet",
        };
      case "reward-marker":
        return {
          id: placeholder.id,
          label: placeholder.label,
          kind: placeholder.kind,
          symbol: "◆",
          accent: "#34d399",
          state: hasRecentReward ? "ready" : "quiet",
          statusLabel: hasRecentReward ? "Badge marker glowing" : "Rewards will settle here",
          detail: "A single reward stone keeps mission-result seams emotionally visible at home.",
          projectionValue: rewardLabel,
          emphasis: hasRecentReward ? "warm" : "quiet",
        };
      case "trophy-plinth":
        return {
          id: placeholder.id,
          label: placeholder.label,
          kind: placeholder.kind,
          symbol: "🏆",
          accent: "#f59e0b",
          state: collectibleCount > 0 ? "ready" : "quiet",
          statusLabel: collectibleCount > 0 ? "Trophy placeholder staged" : "Trophy plinth waiting",
          detail: "Collectible highlights can settle on this plinth as trophy proxies.",
          projectionValue: highlightedCollectibleLabel ?? collectibleProjection,
          emphasis: collectibleCount > 0 ? "warm" : "quiet",
        };
      case "visitor-signal":
        return {
          id: placeholder.id,
          label: placeholder.label,
          kind: placeholder.kind,
          symbol: "◌",
          accent: "#a78bfa",
          state: "quiet",
          statusLabel: "Future visitor seam",
          detail: "Reserved for asynchronous friend/guide visit markers later.",
          projectionValue: null,
          emphasis: "quiet",
        };
      case "collectible-signal":
      case "collectible-expansion":
        return {
          id: placeholder.id,
          label: placeholder.label,
          kind: placeholder.kind,
          symbol: "◒",
          accent: "#fb7185",
          state: collectibleCount > 0 || inventoryUpdateCount > 0 ? "ready" : "quiet",
          statusLabel:
            collectibleCount > 0 || inventoryUpdateCount > 0
              ? "Collectible placeholders updated"
              : "Future collectible seam",
          detail:
            placeholder.kind === "collectible-expansion"
              ? "Expandable shelf seam for future collectible categories."
              : "A compact collectible nook that reflects projected keepsake totals.",
          projectionValue: collectibleProjection,
          emphasis: collectibleCount > 0 ? "soft" : "quiet",
        };
      default:
        return {
          id: placeholder.id,
          label: placeholder.label,
          kind: placeholder.kind,
          symbol: "•",
          accent: "#94a3b8",
          state: "quiet",
          statusLabel: "Reserved seam",
          detail: "Reserved hook for future home-lane integrations.",
          projectionValue: null,
          emphasis: "quiet",
        };
    }
  });

  const readyCount = signals.filter((signal) => signal.state === "ready").length;
  const detail =
    readyCount > 0
      ? `${readyCount} home marker${readyCount === 1 ? "" : "s"} currently glowing.`
      : args.runtime.homeLane.summary;

  return {
    title: args.runtime.homeLane.title,
    detail,
    signals,
    readyCount,
  };
}
