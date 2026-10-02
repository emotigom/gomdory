import type {
  StudentExecutionBlockedReasonCategory,
  StudentExecutionRequestIdOwnership,
} from "@/lib/edu/lesson/studentExecutionSemantics";
import {
  resolveStudentExecutionRequestIdOwnership,
  resolveStudentExecutionRetryMode,
} from "@/lib/edu/lesson/studentExecutionSemantics";

export type StudentCoachSubmitSource =
  | "enter"
  | "submit"
  | "send_button"
  | "retry"
  | "fallback_retry";

export type StudentCoachDispatchMode = "start" | "retry";

const STUDENT_COACH_RETRY_SOURCES = ["retry", "fallback_retry"] as const;

export type StudentCoachDispatchBlockedReason =
  | "empty_prompt"
  | "generation_running"
  | "coach_unavailable"
  | "ops_locked";

export type StudentCoachDispatchDecision =
  | {
      kind: "start";
      mode: StudentCoachDispatchMode;
      source: StudentCoachSubmitSource;
      prompt: string;
      requestId: string;
      requestIdOwnership: StudentExecutionRequestIdOwnership;
    }
  | {
      kind: "blocked";
      mode: StudentCoachDispatchMode;
      source: StudentCoachSubmitSource;
      prompt: string;
      requestId: null;
      requestIdOwnership: StudentExecutionRequestIdOwnership;
      reason: StudentCoachDispatchBlockedReason;
      reasonCategory: StudentExecutionBlockedReasonCategory;
    };

const STUDENT_COACH_BLOCKED_REASON_CATEGORIES: Record<
  StudentCoachDispatchBlockedReason,
  StudentExecutionBlockedReasonCategory
> = {
  empty_prompt: "input",
  generation_running: "concurrency",
  coach_unavailable: "availability",
  ops_locked: "policy",
};

const resolveDispatchMode = (source: StudentCoachSubmitSource): StudentCoachDispatchMode =>
  resolveStudentExecutionRetryMode({ source, retrySources: STUDENT_COACH_RETRY_SOURCES });

const buildBlockedDecision = (input: {
  mode: StudentCoachDispatchMode;
  source: StudentCoachSubmitSource;
  prompt: string;
  reason: StudentCoachDispatchBlockedReason;
}): StudentCoachDispatchDecision => ({
  kind: "blocked",
  mode: input.mode,
  source: input.source,
  prompt: input.prompt,
  requestId: null,
  requestIdOwnership: resolveStudentExecutionRequestIdOwnership(null),
  reason: input.reason,
  reasonCategory: STUDENT_COACH_BLOCKED_REASON_CATEGORIES[input.reason],
});

export const resolveStudentCoachDispatchDecision = (input: {
  source: StudentCoachSubmitSource;
  inputValue: string;
  isGeneratingFiles: boolean;
  coachUnavailable: boolean;
  isOpsModeLocked: boolean;
  createRequestId: () => string;
}): StudentCoachDispatchDecision => {
  const prompt = input.inputValue.trim();
  const mode = resolveDispatchMode(input.source);

  if (!prompt) {
    return buildBlockedDecision({ mode, source: input.source, prompt, reason: "empty_prompt" });
  }

  if (input.isGeneratingFiles) {
    return buildBlockedDecision({ mode, source: input.source, prompt, reason: "generation_running" });
  }

  if (input.coachUnavailable) {
    return buildBlockedDecision({ mode, source: input.source, prompt, reason: "coach_unavailable" });
  }

  if (input.isOpsModeLocked) {
    return buildBlockedDecision({ mode, source: input.source, prompt, reason: "ops_locked" });
  }

  return {
    kind: "start",
    mode,
    source: input.source,
    prompt,
    requestId: input.createRequestId(),
    requestIdOwnership: "new",
  };
};
