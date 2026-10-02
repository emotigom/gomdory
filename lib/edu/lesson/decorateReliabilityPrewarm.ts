export type DecoratePrewarmStep =
  | "snapshot_hash_readiness"
  | "controller_store_readiness"
  | "intent_router_warm_state"
  | "minimal_server_payload_scaffold"
  | "preview_cache_lookup_scaffold"
  | "history_context_seed";

export type DecoratePrewarmInput = {
  requestId: string;
  signal?: AbortSignal;
  runStep: (step: DecoratePrewarmStep) => Promise<void>;
  onTelemetry?: (event: "decorate_prewarm_started" | "decorate_prewarm_completed" | "decorate_prewarm_skipped" | "decorate_prewarm_stale", extra?: Record<string, unknown>) => void;
};

const STEPS: DecoratePrewarmStep[] = [
  "snapshot_hash_readiness",
  "controller_store_readiness",
  "intent_router_warm_state",
  "minimal_server_payload_scaffold",
  "preview_cache_lookup_scaffold",
  "history_context_seed",
];

export const runDecorateReliabilityPrewarm = async (input: DecoratePrewarmInput) => {
  input.onTelemetry?.("decorate_prewarm_started", { requestId: input.requestId });
  for (const step of STEPS) {
    if (input.signal?.aborted) {
      input.onTelemetry?.("decorate_prewarm_stale", { requestId: input.requestId, step });
      return;
    }
    try {
      await input.runStep(step);
    } catch {
      input.onTelemetry?.("decorate_prewarm_skipped", { requestId: input.requestId, step });
    }
  }
  input.onTelemetry?.("decorate_prewarm_completed", { requestId: input.requestId });
};
