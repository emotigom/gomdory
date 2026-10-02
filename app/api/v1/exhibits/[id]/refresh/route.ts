import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { generateSafePayload } from "@/lib/exhibit/generateSafePayload";
import { isExhibitActive } from "@/lib/exhibit/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RefreshDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  generateSafePayloadFn?: typeof generateSafePayload;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  deps?: RefreshDeps,
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
    .select("id, board_id, owner_id, status")
    .eq("id", id)
    .maybeSingle<{ id: string; board_id: string; owner_id: string; status: string }>();

  if (error || !existing || !isExhibitActive(existing.status as "active" | "hidden" | "revoked" | null)) {
    return jsonError("not_found", "전시 링크를 찾지 못했습니다.", 404);
  }

  if (existing.owner_id !== userId) {
    return jsonError("forbidden", "권한이 없습니다.", 403);
  }

  const buildPayload = deps?.generateSafePayloadFn ?? generateSafePayload;
  const payload = await buildPayload(existing.board_id);

  const { error: versionError } = await admin.from("exhibit_versions").insert({
    exhibit_id: existing.id,
    schema_version: payload.schemaVersion,
    payload,
  });

  if (versionError) {
    return jsonError("refresh_failed", "전시 요약을 갱신하지 못했습니다.", 500);
  }

  const { error: updateError } = await admin
    .from("exhibits")
    .update({ last_generated_at: payload.generatedAt })
    .eq("id", existing.id);

  if (updateError) {
    return jsonError("refresh_failed", "전시 링크를 갱신하지 못했습니다.", 500);
  }

  return NextResponse.json({ ok: true, last_generated_at: payload.generatedAt });
}
