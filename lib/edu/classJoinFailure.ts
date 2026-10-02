import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId } from "@/lib/api/server/response";
import { recordOpsEvent, type OpsEventInput } from "@/lib/ops/recordEvent";

type RecordJoinFailureEvent = (event: OpsEventInput, options: { sampleRate: number; hardLimitPerMinute: number }) =>
  | Promise<unknown>
  | unknown;

export function emitEduClassJoinSaveFailure(input: {
  requestId: string;
  route: string;
  status?: number;
  recordEvent?: RecordJoinFailureEvent;
}) {
  const recordEvent = input.recordEvent ?? recordOpsEvent;

  void Promise.resolve(
    recordEvent(
      {
        level: "error",
        kind: "api_error",
        requestId: input.requestId,
        route: input.route,
        status: input.status ?? 500,
        meta: {
          stage: "edu_join",
          component: "database",
          result: "failed",
          mappedReason: "participant_save_failed",
        },
      },
      { sampleRate: 1, hardLimitPerMinute: 120 },
    ),
  ).catch(() => undefined);

  return jsonErrorWithRequestId(
    "JOIN_FAILED",
    "참여 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
    input.requestId,
    input.status ?? 500,
    undefined,
    withNoStoreHeaders(),
  );
}
