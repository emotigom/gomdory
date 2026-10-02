import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isExhibitActive } from "@/lib/exhibit/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RevokeDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  deps?: RevokeDeps,
): Promise<Response> {
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;
  let userId = "";
  try {
    const { user } = await requireUser();
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const { id } = await params;
  const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data: existing, error } = await admin
    .from("exhibits")
    .select("id, owner_id, status")
    .eq("id", id)
    .maybeSingle<{ id: string; owner_id: string; status: string }>();

  if (error || !existing || !isExhibitActive(existing.status as "active" | "hidden" | "revoked" | null)) {
    return jsonError("not_found", "전시 링크를 찾지 못했습니다.", 404);
  }

  if (existing.owner_id !== userId) {
    return jsonError("forbidden", "권한이 없습니다.", 403);
  }

  const { error: updateError } = await admin
    .from("exhibits")
    .update({ status: "revoked" })
    .eq("id", existing.id);

  if (updateError) {
    return jsonError("revoke_failed", "전시 링크를 중단하지 못했습니다.", 500);
  }

  return NextResponse.json({ ok: true });
}
