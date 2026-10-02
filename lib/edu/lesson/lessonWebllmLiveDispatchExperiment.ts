export type LessonWebllmContainedDispatchAvailability = {
  bootstrapReady: boolean;
  canonicalAssetReady: boolean;
  effectiveWebllmEnabled: boolean;
  wouldDispatchToWebllm: boolean;
  initialStatus: "READY" | "DEGRADED" | string;
  degradedRetryAllowed: boolean;
};

export type LessonWebllmContainedDispatchPlan = {
  attemptLocalDispatch: boolean;
  fallbackReason: "not_ready" | "degraded" | "blocked" | null;
  noAttemptReason: "blocked" | "not_ready" | "degraded" | null;
};

export type LessonWebllmExperimentOutcome = {
  attemptState: "no_attempt" | "attempted";
  noAttemptReason: LessonWebllmContainedDispatchPlan["noAttemptReason"];
  fallbackReason: "not_ready" | "degraded" | "blocked" | "timeout" | "engine_error" | "no_response" | null;
  successReason: "local_dispatch_succeeded" | null;
};

export const resolveLessonWebllmExperimentOutcome = (input: {
  plan: LessonWebllmContainedDispatchPlan;
  dispatchFailureReason?: string | null;
  localDispatchSucceeded?: boolean;
}): LessonWebllmExperimentOutcome => {
  if (!input.plan.attemptLocalDispatch) {
    return {
      attemptState: "no_attempt",
      noAttemptReason: input.plan.noAttemptReason,
      fallbackReason: input.plan.fallbackReason,
      successReason: null,
    };
  }

  if (input.localDispatchSucceeded) {
    return {
      attemptState: "attempted",
      noAttemptReason: null,
      fallbackReason: null,
      successReason: "local_dispatch_succeeded",
    };
  }

  const normalizedFailureReason =
    input.dispatchFailureReason === "timeout" ||
    input.dispatchFailureReason === "engine_error" ||
    input.dispatchFailureReason === "no_response"
      ? input.dispatchFailureReason
      : null;

  return {
    attemptState: "attempted",
    noAttemptReason: null,
    fallbackReason: normalizedFailureReason,
    successReason: null,
  };
};

export const resolveLessonWebllmContainedDispatchPlan = (
  input: LessonWebllmContainedDispatchAvailability,
): LessonWebllmContainedDispatchPlan => {
  if (!input.wouldDispatchToWebllm) {
    return {
      attemptLocalDispatch: false,
      fallbackReason: "blocked",
      noAttemptReason: "blocked",
    };
  }

  if (!input.effectiveWebllmEnabled) {
    return {
      attemptLocalDispatch: false,
      fallbackReason: "not_ready",
      noAttemptReason: "not_ready",
    };
  }

  if (!input.bootstrapReady || !input.canonicalAssetReady) {
    return {
      attemptLocalDispatch: false,
      fallbackReason: "not_ready",
      noAttemptReason: "not_ready",
    };
  }

  const allowLocalStatus =
    input.initialStatus === "READY" ||
    (input.initialStatus === "DEGRADED" && input.degradedRetryAllowed);

  if (!allowLocalStatus) {
    return {
      attemptLocalDispatch: false,
      fallbackReason:
        input.initialStatus === "DEGRADED" && !input.degradedRetryAllowed
          ? "degraded"
          : "not_ready",
      noAttemptReason:
        input.initialStatus === "DEGRADED" && !input.degradedRetryAllowed
          ? "degraded"
          : "not_ready",
    };
  }

  return {
    attemptLocalDispatch: true,
    fallbackReason: null,
    noAttemptReason: null,
  };
};

export const shouldFallbackToOpenAiMainline = (failureReason: string): boolean =>
  failureReason === "timeout" || failureReason === "engine_error";
