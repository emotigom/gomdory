import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isExhibitActive } from "@/lib/exhibit/status";
import type { ExhibitPayload } from "@/lib/exhibit/types";

type PublicExhibitDeps = {
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
  deps?: PublicExhibitDeps,
): Promise<Response> {
  const { token } = await params;
  const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data: exhibit, error } = await admin
    .from("exhibits")
    .select("id, status")
    .eq("token", token)
    .maybeSingle<{ id: string; status: string }>();

  if (error || !exhibit || !isExhibitActive(exhibit.status as "active" | "hidden" | "revoked" | null)) {
    return jsonError("not_found", "전시 링크를 찾지 못했습니다.", 404);
  }

  const { data: version, error: versionError } = await admin
    .from("exhibit_versions")
    .select("payload")
    .eq("exhibit_id", exhibit.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ payload: ExhibitPayload }>();

  if (versionError || !version) {
    return jsonError("not_found", "전시 데이터를 찾지 못했습니다.", 404);
  }

  const response = NextResponse.json(version.payload);
  response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
  return response;
}
