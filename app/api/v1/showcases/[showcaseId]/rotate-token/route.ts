import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { buildShowcaseUrl } from "@/lib/http/publicLinks";
import { getRequestHost, getRequestProto } from "@/lib/http/requestHost";
import { getTeacherCanonicalOrigin, isTeacherHost } from "@/lib/http/siteConfig";
import { createShowcaseToken } from "@/lib/showcase/token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function isLocalHost(host: string) {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

type RotateDeps = {
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  createShowcaseTokenFn?: typeof createShowcaseToken;
  requireUserApiFn?: typeof requireUserApi;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ showcaseId: string }> },
  deps?: RotateDeps,
): Promise<Response> {
  let userId = "";
  try {
    const requireUser = deps?.requireUserApiFn ?? requireUserApi;
    const { user } = await requireUser();
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const { showcaseId } = await params;
  if (!showcaseId) {
    return jsonError("invalid_showcase_id", "쇼케이스 ID를 확인해주세요.");
  }

  const [host, proto] = await Promise.all([getRequestHost(request.headers), getRequestProto(request.headers)]);
  if (!isTeacherHost(host) && !isLocalHost(host)) {
    return jsonError("forbidden_host", "교사용 도메인에서만 사용할 수 있습니다.", 403);
  }

  const admin = deps?.createSupabaseAdminClientFn?.() ?? createSupabaseAdminClient();
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
  await admin.from("showcase_tokens").update({ revoked_at: revokedAt }).eq("showcase_id", showcase.id);

  const tokenBuilder = deps?.createShowcaseTokenFn ?? createShowcaseToken;
  const token = tokenBuilder();
  const { error: insertError } = await admin
    .from("showcase_tokens")
    .insert({ token, showcase_id: showcase.id });

  if (insertError) {
    return jsonError("rotate_failed", "토큰을 회전하지 못했습니다.", 500);
  }

  const canonicalOrigin = getTeacherCanonicalOrigin(proto);
  return NextResponse.json({
    ok: true,
    token,
    url: {
      canonical: `${canonicalOrigin}/x/${token}`,
      short: buildShowcaseUrl(token, proto),
    },
  });
}
