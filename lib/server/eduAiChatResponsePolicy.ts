import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { EDU_PROVIDER_RESULT, EDU_PROVIDER_TARGET } from "@/lib/edu/providerBoundary";
import { toSnakeKeys } from "@/lib/standards/fields";
import {
  buildEduAiStudentAnswerMissingPayload,
  buildEduAiStudentBackendFailureEnvelope,
  buildEduAiStudentSuccessPayload,
  type EduAiStudentRouteResponseAssembly,
  type EduServiceStepDecisionHandlers,
} from "@/lib/server/eduAiBackendClient";

export type EduAiChatResponsePolicyContext = {
  requestId: string;
  route: string;
};

export type EduAiChatResponsePolicyDependencies = {
  recordOpsEvent: typeof recordOpsEvent;
};

type EduAiChatResponsePolicyInput = EduAiChatResponsePolicyContext & {
  dependencies?: EduAiChatResponsePolicyDependencies;
};

const defaultDependencies: EduAiChatResponsePolicyDependencies = { recordOpsEvent };

export function createEduAiChatResponseHandlers(
  input: EduAiChatResponsePolicyInput,
): EduServiceStepDecisionHandlers<EduAiStudentRouteResponseAssembly> {
  const dependencies = input.dependencies ?? defaultDependencies;
  return {
    onBackendFailure: ({ backend }) => {
      void dependencies
        .recordOpsEvent(
          toSnakeKeys({
            level: "error",
            kind: "api_error",
            requestId: input.requestId,
            route: input.route,
            status: backend.status,
            meta: {
              stage: "edu_ai_remote",
              provider: EDU_PROVIDER_TARGET.backendProxy,
              result: EDU_PROVIDER_RESULT.failed,
              mappedReason: backend.diagnostics.mappedReason,
            },
          }) as Parameters<typeof recordOpsEvent>[0],
          { sampleRate: 1, hardLimitPerMinute: 120 },
        )
        .catch(() => undefined);

      return {
        payload: buildEduAiStudentBackendFailureEnvelope({
          base: {
            ok: false,
            code: "EDU_AI_REMOTE_FAILED",
            usedFallback: false,
            message: "AI 응답 생성에 실패했어요. 잠시 후 다시 시도해 주세요.",
          },
          backend,
          result: EDU_PROVIDER_RESULT.failed,
        }),
        status: backend.status,
      };
    },
    onAnswerMissing: () => ({
      payload: buildEduAiStudentAnswerMissingPayload({
        code: "EDU_AI_REMOTE_FAILED",
        reason: "unknown",
        message: "AI 응답을 읽지 못했어요.",
      }),
      status: 502,
    }),
    onSuccess: ({ answer }) => ({
      payload: buildEduAiStudentSuccessPayload({ answer, includeMessage: true }),
      status: 200,
    }),
  };
}
