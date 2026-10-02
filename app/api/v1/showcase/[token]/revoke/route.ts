import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const { token } = await params;
  const admin = createSupabaseAdminClient();
  const { data: tokenRow, error: tokenError } = await admin
    .from("showcase_tokens")
    .select("token, showcase_id, revoked_at")
    .eq("token", token)
    .maybeSingle<{ token: string; showcase_id: string; revoked_at: string | null }>();

  if (tokenError || !tokenRow || tokenRow.revoked_at) {
    return jsonError("not_found", "쇼케이스를 찾지 못했습니다.", 404);
  }

  const { data: existing, error } = await admin
    .from("showcases")
    .select("id, owner_id, is_revoked")
    .eq("id", tokenRow.showcase_id)
    .maybeSingle<{ id: string; owner_id: string; is_revoked: boolean }>();

  if (error || !existing || existing.is_revoked) {
    return jsonError("not_found", "쇼케이스를 찾지 못했습니다.", 404);
  }

  if (existing.owner_id !== userId) {
    return jsonError("forbidden", "권한이 없습니다.", 403);
  }

  const revokedAt = new Date().toISOString();
  const { error: updateError } = await admin.from("showcases").update({ is_revoked: true }).eq("id", existing.id);

  if (updateError) {
    return jsonError("revoke_failed", "리보크하지 못했습니다.", 500);
  }

  await admin.from("showcase_tokens").update({ revoked_at: revokedAt }).eq("showcase_id", existing.id);

  return NextResponse.json({ ok: true });
}
