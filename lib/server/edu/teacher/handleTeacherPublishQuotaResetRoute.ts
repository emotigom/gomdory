import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { buildPublishQuotaIdentity, getKstDayRange } from "@/lib/edu/publish/quota";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResetBody = {
  shareCode?: string;
  lessonId?: number | string;
  authorName?: string;
  rid?: string;
};

type EduProjectUpdatePayload = Database["public"]["Tables"]["edu_projects"]["Update"];

export async function handleTeacherPublishQuotaResetRoute({ requestId, payload }: { requestId: string; payload: ResetBody | null } ): Promise<Response> {
  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  try {
    await requireUserApi();
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const shareCode = normalizeShareCode(payload.shareCode ?? "");
  const lessonIdRaw = typeof payload.lessonId === "string" ? Number(payload.lessonId) : payload.lessonId;
  const lessonId = Number.isFinite(lessonIdRaw) ? Number(lessonIdRaw) : null;
  const authorName = typeof payload.authorName === "string" ? payload.authorName.trim() : "";
  const rid = typeof payload.rid === "string" ? payload.rid.trim() : "";

  if (!isLikelyShareCode(shareCode) || !lessonId || (!authorName && !rid)) {
    return jsonErrorWithRequestId("INVALID_PARAMS", "shareCode, lessonId and (authorName or rid) are required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: joinCodeRow, error: joinCodeError } = await supabaseAdmin.from("edu_join_codes").select("board_id").eq("code", shareCode).maybeSingle();
  if (joinCodeError || !joinCodeRow?.board_id) {
    return jsonErrorWithRequestId("CLASSROOM_NOT_FOUND", "classroom_not_found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const supabaseServer = createSupabaseServerClient();
  const { data: role } = await supabaseServer.rpc("board_role", { bid: joinCodeRow.board_id });
  if (normalizeBoardRole(role) === "viewer") {
    return jsonErrorWithRequestId("FORBIDDEN", "forbidden", requestId, 403, undefined, withNoStoreHeaders());
  }

  let targetAuthor = authorName;
  let resolvedQuotaKey: string | null = null;
  if (rid && !targetAuthor) {
    const { data: byRid } = await supabaseAdmin
      .from("edu_projects")
      .select("authorName:author_name, publishQuotaKey:publish_quota_key")
      .eq("last_request_id", rid)
      .eq("share_code", shareCode)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    targetAuthor = byRid?.authorName ?? "";
    resolvedQuotaKey = byRid?.publishQuotaKey ?? null;
  }

  if (!targetAuthor) {
    return jsonErrorWithRequestId("RESET_TARGET_NOT_FOUND", "reset_target_not_found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const quota = resolvedQuotaKey ? { quotaKey: resolvedQuotaKey, keyType: "student/day" as const } : buildPublishQuotaIdentity({ shareCode, lessonId, authorName: targetAuthor });
  const dayRange = getKstDayRange();

  const { error, count } = await supabaseAdmin
    .from("edu_projects")
    .update(toSnakeKeys({ publishQuotaKey: null }) as EduProjectUpdatePayload, { count: "exact" })
    .eq("publish_quota_key", quota.quotaKey)
    .eq("publish_state", "PUBLISHED")
    .gte("last_published_at", dayRange.startIso)
    .lte("last_published_at", dayRange.endIso);

  if (error) {
    return jsonErrorWithRequestId("RESET_FAILED", error.message, requestId, 500, undefined, withNoStoreHeaders());
  }

  return jsonOkWithRequestId({ resetCount: count ?? 0, quotaKey: quota.quotaKey, day: dayRange.day }, requestId, withNoStoreHeaders());
}
