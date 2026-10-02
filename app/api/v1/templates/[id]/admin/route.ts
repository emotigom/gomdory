import { NextResponse } from "next/server";

import { isOpsOwner } from "@/lib/auth/opsOwners";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AdminDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

type AdminPayload = {
  pro_only?: boolean;
  visibility?: "public" | "unlisted" | "hidden";
  picks_rank?: number | null;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function parsePayload(input: unknown): AdminPayload | null {
  if (!input || typeof input !== "object") return null;
  const data = input as Record<string, unknown>;
  const output: AdminPayload = {};

  if (data.pro_only !== undefined) {
    if (typeof data.pro_only !== "boolean") return null;
    output.pro_only = data.pro_only;
  }

  if (data.visibility !== undefined) {
    if (data.visibility !== "public" && data.visibility !== "unlisted" && data.visibility !== "hidden") return null;
    output.visibility = data.visibility;
  }

  if (data.picks_rank !== undefined) {
    if (data.picks_rank === null) {
      output.picks_rank = null;
    } else if (typeof data.picks_rank === "number" && Number.isFinite(data.picks_rank)) {
      output.picks_rank = Math.max(0, Math.floor(data.picks_rank));
    } else {
      return null;
    }
  }

  return output;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  deps?: AdminDeps,
) {
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  if (!isOpsOwner(user.email)) {
    return jsonError("forbidden", "권한이 없습니다.", 403);
  }

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return jsonError("invalid_template_id", "템플릿 ID 형식이 올바르지 않습니다.");
  }

  const body = await request.json().catch(() => null);
  const payload = parsePayload(body);
  if (!payload || Object.keys(payload).length === 0) {
    return jsonError("invalid_payload", "요청 형식이 올바르지 않습니다.");
  }

  const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data, error } = await admin
    .from("templates")
    .update(payload)
    .eq("template_id", id)
    .select("template_id, title, description, tags, cover_file_id, stats, created_at, pro_only, picks_rank, visibility")
    .maybeSingle();

  if (error) {
    return jsonError("template_update_failed", error.message, 502);
  }

  if (!data) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  return NextResponse.json({
    ok: true,
    template: {
      id: data.template_id as string,
      title: data.title as string,
      description: (data.description as string | null) ?? null,
      tags: (data.tags as string[]) ?? [],
      coverUrl: null,
      installCount: Number((data.stats as Record<string, unknown> | null | undefined)?.clones ?? 0),
      createdAt: data.created_at as string,
      accessLevel: data.pro_only ? "pro" : "free",
      isFeatured: data.picks_rank != null,
      featuredRank: (data.picks_rank as number | null) ?? null,
      visibility: data.visibility,
    },
  });
}
