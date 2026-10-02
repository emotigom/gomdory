export type ActionUsageSource = "palette" | "contextmenu";

export type ActionUsageLogInput = {
  actionId: string;
  surface: "palette" | "context";
  source: ActionUsageSource;
  isAdvanced: boolean;
  isDangerous: boolean;
  requestId?: string;
};

export function logActionUsage(input: ActionUsageLogInput): void {
  try {
    const payload = {
      ts: new Date().toISOString(),
      event: "action_usage",
      actionId: input.actionId,
      surface: input.surface,
      source: input.source,
      isAdvanced: input.isAdvanced,
      isDangerous: input.isDangerous,
      requestId: input.requestId,
    };

    console.info("[action-usage]", payload);
  } catch {
    // fail-open: telemetry should never break action execution
  }
}
