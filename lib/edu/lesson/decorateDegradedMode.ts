export type DecorateDegradedMode = "normal" | "degraded_light" | "degraded_strict";

export type DecorateDegradedInput = {
  kickoffDelayMs?: number | null;
  previewBuildDelayMs?: number | null;
  snapshotReady?: boolean;
  hashReady?: boolean;
  hydrationStable?: boolean;
  recentSlaBreach?: boolean;
  networkTimeoutSignal?: boolean;
};

export type DecorateDegradedDecision = {
  mode: DecorateDegradedMode;
  reasons: string[];
  forceDeterministicFallback: boolean;
  skipNonEssentialShaping: boolean;
  preferCachedIntent: boolean;
  preferMinimalPreviewPlan: boolean;
};

export const decideDecorateDegradedMode = (input: DecorateDegradedInput): DecorateDegradedDecision => {
  const reasons: string[] = [];
  const kickoffDelayMs = input.kickoffDelayMs ?? 0;
  const previewBuildDelayMs = input.previewBuildDelayMs ?? 0;

  if (kickoffDelayMs >= 900) reasons.push("kickoff_slow");
  if (previewBuildDelayMs >= 3000) reasons.push("preview_build_slow");
  if (input.snapshotReady === false) reasons.push("snapshot_pending");
  if (input.hashReady === false) reasons.push("hash_pending");
  if (input.hydrationStable === false) reasons.push("hydration_unstable");
  if (input.recentSlaBreach) reasons.push("recent_sla_breach");
  if (input.networkTimeoutSignal) reasons.push("network_timeout_signal");

  const hard = reasons.includes("network_timeout_signal") || reasons.includes("recent_sla_breach") || reasons.length >= 3;
  const light = !hard && reasons.length > 0;
  const mode: DecorateDegradedMode = hard ? "degraded_strict" : light ? "degraded_light" : "normal";

  return {
    mode,
    reasons,
    forceDeterministicFallback: mode === "degraded_strict",
    skipNonEssentialShaping: mode !== "normal",
    preferCachedIntent: mode !== "normal",
    preferMinimalPreviewPlan: mode !== "normal",
  };
};
