import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { apiErrorResponse } from "@/lib/http/apiError";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = crypto.randomUUID();
  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return apiErrorResponse("unauthorized", "인증이 필요합니다.", 401, { requestId });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("website_studio_published_snapshots")
    .update({ status: "unpublished" } as never)
    .eq("id", id)
    .eq("owner_user_id", userId);
  if (error) return apiErrorResponse("unpublish_failed", "게시 해제에 실패했습니다.", 500, { requestId });
  return NextResponse.json({ ok: true, requestId });
}
