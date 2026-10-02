import type {
  StudentDecorateCtaMode,
  StudentDecorateUiState,
} from "@/lib/edu/lesson/studentDecorateUi";
import type {
  StudentExecutionBlockedReasonCategory,
  StudentExecutionRequestIdOwnership,
} from "@/lib/edu/lesson/studentExecutionSemantics";
import { resolveStudentExecutionRequestIdOwnership } from "@/lib/edu/lesson/studentExecutionSemantics";

export type StudentDecorateSubmitSource = "enter" | "send" | "cta";

export type StudentDecorateDispatchBlockedReason =
  | "disabled_cta"
  | "empty_prompt"
  | "invalid_state"
  | "missing_share_code"
  | "teacher_mode_branch";

export type StudentDecorateDispatchDecision =
  | {
      kind: "apply";
      mode: "apply";
      state: "ready";
      disabled: false;
      source: StudentDecorateSubmitSource;
      prompt: string;
      requestId: string | null;
      requestIdOwnership: StudentExecutionRequestIdOwnership;
    }
  | {
      kind: "start";
      mode: "start";
      state: "idle" | "failed";
      disabled: false;
      source: StudentDecorateSubmitSource;
      prompt: string;
      requestId: string;
      requestIdOwnership: StudentExecutionRequestIdOwnership;
    }
  | {
      kind: "blocked";
      mode: StudentDecorateCtaMode;
      state: StudentDecorateUiState;
      disabled: boolean;
      source: StudentDecorateSubmitSource;
      prompt: string;
      requestId: string | null;
      requestIdOwnership: StudentExecutionRequestIdOwnership;
      reason: StudentDecorateDispatchBlockedReason;
      reasonCategory: StudentExecutionBlockedReasonCategory;
    };

const canStartStudentDecorateFromState = (state: StudentDecorateUiState) =>
  state === "idle" || state === "failed";

const STUDENT_DECORATE_BLOCKED_REASON_CATEGORIES: Record<
  StudentDecorateDispatchBlockedReason,
  StudentExecutionBlockedReasonCategory
> = {
  disabled_cta: "state",
  empty_prompt: "input",
  invalid_state: "state",
  missing_share_code: "availability",
  teacher_mode_branch: "policy",
};

const buildBlockedDecision = (input: {
  mode: StudentDecorateCtaMode;
  state: StudentDecorateUiState;
  disabled: boolean;
  source: StudentDecorateSubmitSource;
  prompt: string;
  requestId: string | null;
  reason: StudentDecorateDispatchBlockedReason;
}): StudentDecorateDispatchDecision => ({
  kind: "blocked",
  mode: input.mode,
  state: input.state,
  disabled: input.disabled,
  source: input.source,
  prompt: input.prompt,
  requestId: input.requestId,
  requestIdOwnership: resolveStudentExecutionRequestIdOwnership(input.requestId),
  reason: input.reason,
  reasonCategory: STUDENT_DECORATE_BLOCKED_REASON_CATEGORIES[input.reason],
});

export const resolveStudentDecorateDispatchDecision = (input: {
  source: StudentDecorateSubmitSource;
  uiState: StudentDecorateUiState;
  ctaMode: StudentDecorateCtaMode;
  ctaDisabled: boolean;
  inputValue: string;
  shareCode: string | null | undefined;
  isTeacherMode: boolean;
  createRequestId: () => string;
  pendingRequestId?: string | null;
}): StudentDecorateDispatchDecision => {
  const prompt = input.inputValue.trim();

  if (input.ctaDisabled) {
    return buildBlockedDecision({
      mode: input.ctaMode,
      state: input.uiState,
      disabled: true,
      source: input.source,
      prompt,
      requestId: input.pendingRequestId ?? null,
      reason: input.uiState === "idle" && !prompt ? "empty_prompt" : "disabled_cta",
    });
  }

  if (input.ctaMode === "apply") {
    if (input.uiState === "ready") {
      return {
        kind: "apply",
        mode: "apply",
        state: "ready",
        disabled: false,
        source: input.source,
        prompt,
        requestId: input.pendingRequestId ?? null,
        requestIdOwnership: resolveStudentExecutionRequestIdOwnership(input.pendingRequestId ?? null),
      };
    }
    return buildBlockedDecision({
      mode: input.ctaMode,
      state: input.uiState,
      disabled: input.ctaDisabled,
      source: input.source,
      prompt,
      requestId: input.pendingRequestId ?? null,
      reason: "invalid_state",
    });
  }

  if (!prompt) {
    return buildBlockedDecision({
      mode: input.ctaMode,
      state: input.uiState,
      disabled: input.ctaDisabled,
      source: input.source,
      prompt,
      requestId: null,
      reason: "empty_prompt",
    });
  }

  if (!input.shareCode) {
    return buildBlockedDecision({
      mode: input.ctaMode,
      state: input.uiState,
      disabled: input.ctaDisabled,
      source: input.source,
      prompt,
      requestId: null,
      reason: "missing_share_code",
    });
  }

  if (input.isTeacherMode) {
    return buildBlockedDecision({
      mode: input.ctaMode,
      state: input.uiState,
      disabled: input.ctaDisabled,
      source: input.source,
      prompt,
      requestId: null,
      reason: "teacher_mode_branch",
    });
  }

  if (!canStartStudentDecorateFromState(input.uiState)) {
    return buildBlockedDecision({
      mode: input.ctaMode,
      state: input.uiState,
      disabled: input.ctaDisabled,
      source: input.source,
      prompt,
      requestId: null,
      reason: "invalid_state",
    });
  }

  return {
    kind: "start",
    mode: "start",
    state: input.uiState,
    disabled: false,
    source: input.source,
    prompt,
    requestId: input.createRequestId(),
    requestIdOwnership: "new",
  };
};

export const resolveStudentDecorateStartOutcomeState = (input: {
  ok: boolean;
  canApplyPreview: boolean;
}): StudentDecorateUiState => {
  if (input.ok && input.canApplyPreview) {
    return "ready";
  }
  return "failed";
};
