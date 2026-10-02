/**
 * Provider/fallback-adjacent availability glue for student execution entrypoints.
 *
 * This stays separate from dispatch semantics (`student*Execution.ts`) and from
 * post-dispatch execution pipelines (`runDecorateFlow.ts`) so contributors can
 * place new provider-readiness logic without growing ChatPanel orchestration.
 */
export type StudentExecutionProviderAvailability = {
  openaiConfigured: boolean;
  openaiProxyReachable: boolean;
  openaiUsable: boolean;
  webllmAvailable: boolean;
  webllmUsable: boolean;
  fallbackAvailable: boolean;
  reasonCodes: string[];
};

export const resolveStudentProviderAvailability = (input: {
  openaiConfigured: boolean;
  openaiProxyReachable: boolean;
  webllmAvailable: boolean;
  bypassRequested: boolean;
  webllmUnavailableReason?: "env_missing" | "loading_too_long" | "init_failed" | "disabled" | "unavailable" | null;
}): StudentExecutionProviderAvailability => {
  const reasonCodes: string[] = [];

  if (!input.openaiConfigured) {
    reasonCodes.push("openai_unconfigured");
  }
  if (!input.openaiProxyReachable) {
    reasonCodes.push("openai_proxy_unreachable");
  }

  if (!input.webllmAvailable) {
    reasonCodes.push(
      input.webllmUnavailableReason === "env_missing"
        ? "webllm_env_missing"
        : input.webllmUnavailableReason === "loading_too_long"
          ? "webllm_loading_too_long"
          : input.webllmUnavailableReason === "init_failed"
            ? "webllm_init_failed"
            : input.webllmUnavailableReason === "disabled"
              ? "webllm_disabled"
              : input.webllmUnavailableReason === "unavailable"
                ? "webllm_unavailable"
              : "webllm_unavailable",
    );
  }

  if (input.bypassRequested) {
    reasonCodes.push("webllm_bypassed");
  }

  const webllmUsable = input.webllmAvailable && !input.bypassRequested;

  return {
    openaiConfigured: input.openaiConfigured,
    openaiProxyReachable: input.openaiProxyReachable,
    openaiUsable: input.openaiConfigured && input.openaiProxyReachable,
    webllmAvailable: input.webllmAvailable,
    webllmUsable,
    fallbackAvailable: true,
    reasonCodes,
  };
};
