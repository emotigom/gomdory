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

export type EduCoachChatResponsePolicyContext = {
  requestId: string;
  route: string;
};

export type EduCoachChatResponsePolicyDependencies = {
  recordOpsEvent: typeof recordOpsEvent;
};

type EduCoachChatResponsePolicyInput = EduCoachChatResponsePolicyContext & {
  dependencies?: EduCoachChatResponsePolicyDependencies;
};

const defaultDependencies: EduCoachChatResponsePolicyDependencies = { recordOpsEvent };

export function createEduCoachChatResponseHandlers(
  input: EduCoachChatResponsePolicyInput,
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
              stage: "edu_coach_remote",
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
            usedFallback: false,
          },
          backend,
          result: EDU_PROVIDER_RESULT.failed,
        }),
        status: backend.status,
      };
    },
    onAnswerMissing: () => ({
      payload: buildEduAiStudentAnswerMissingPayload({
        reason: "unknown",
        message: "응답을 읽지 못했어요.",
      }),
      status: 502,
    }),
    onSuccess: ({ answer }) => ({
      payload: buildEduAiStudentSuccessPayload({
        answer,
        provider: EDU_PROVIDER_TARGET.backendProxy,
        remoteTargetKind: EDU_PROVIDER_TARGET.backendProxy,
      }),
      status: 200,
    }),
  };
}
