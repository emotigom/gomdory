import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  jsonErrorWithRequestId as respondError,
  jsonOkWithRequestId as respondOk,
} from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { isValidShareCode, normalizeShareCode } from "@/lib/data/share";
import { sanitizeStudentName } from "@/lib/student/studentName";
import { recordOpsEvent } from "@/lib/ops/recordEvent";

export const dynamic = "force-dynamic";

type OwnershipRequestPayload = {
  studentName?: string;
  clientId?: string;
  deviceId?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const requestId = getOrCreateRequestId(request);

  let payload: OwnershipRequestPayload = {};
  try {
    payload = (await request.json()) as OwnershipRequestPayload;
  } catch {
    payload = {};
  }

  const normalizedCode = normalizeShareCode(code);
  if (!isValidShareCode(normalizedCode)) {
    return respondError("invalid_code", "invalid_code", requestId, 404);
  }

  const studentName =
    typeof payload.studentName === "string" ? sanitizeStudentName(payload.studentName) : "";
  const clientId =
    typeof payload.clientId === "string" && payload.clientId.trim()
      ? payload.clientId.trim()
      : typeof payload.deviceId === "string"
        ? payload.deviceId.trim()
        : "";

  if (!studentName || !clientId) {
    return respondError(
      "validation_failed",
      "studentName과 clientId가 필요합니다.",
      requestId,
      400,
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, share_enabled")
    .eq("share_code", normalizedCode)
    .limit(1)
    .maybeSingle();

  if (boardError || !board || !board.share_enabled) {
    return respondError("invalid_code", "invalid_code", requestId, 404);
  }

  const { error } = await supabase.from("ownership_requests").insert({
    board_id: board.id,
    share_code: normalizedCode,
    student_name: studentName,
    new_client_id: clientId,
  });

  if (error) {
    return respondError(
      "request_failed",
      "소유권 복구 요청을 저장하지 못했습니다.",
      requestId,
      500,
    );
  }

  void recordOpsEvent({
    level: "info",
    kind: "auth",
    request_id: requestId,
    route: new URL(request.url).pathname,
    status: 200,
    meta: {
      action: "ownership_request_created",
      boardId: board.id,
      shareCode: normalizedCode,
      studentName,
      newClientId: clientId,
    },
  });

  return respondOk({ status: "requested" }, requestId);
}
