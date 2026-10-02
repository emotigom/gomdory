import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getRequestHost } from "@/lib/http/requestHost";
import { isTeacherHost } from "@/lib/http/siteConfig";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function isLocalHost(host: string) {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ showcaseId: string }> },
): Promise<Response> {
  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const host = await getRequestHost(request.headers);
  if (!isTeacherHost(host) && !isLocalHost(host)) {
    return jsonError("forbidden_host", "교사용 도메인에서만 사용할 수 있습니다.", 403);
  }

  const { showcaseId } = await params;
  if (!showcaseId) {
    return jsonError("invalid_showcase_id", "쇼케이스 ID를 확인해주세요.");
  }

  const admin = createSupabaseAdminClient();
  const { data: showcase, error } = await admin
    .from("showcases")
    .select("id, owner_id, is_revoked")
    .eq("id", showcaseId)
    .maybeSingle<{ id: string; owner_id: string; is_revoked: boolean }>();

  if (error || !showcase || showcase.is_revoked) {
    return jsonError("not_found", "쇼케이스를 찾지 못했습니다.", 404);
  }

  if (showcase.owner_id !== userId) {
    return jsonError("forbidden", "권한이 없습니다.", 403);
  }

  const revokedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("showcases")
    .update({ is_revoked: true })
    .eq("id", showcase.id);

  if (updateError) {
    return jsonError("revoke_failed", "리보크하지 못했습니다.", 500);
  }

  await admin.from("showcase_tokens").update({ revoked_at: revokedAt }).eq("showcase_id", showcase.id);

  return NextResponse.json({ ok: true });
}
