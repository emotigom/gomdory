import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getUserPlan } from "@/lib/billing/getUserPlan";
import { assertPro } from "@/lib/billing/planGates";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createBoardFromTemplatePayload } from "@/lib/templates/installTemplate";
import type { SanitizedTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";
import type { TemplatePayload } from "@/lib/templates/sanitize";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TemplateInstallDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  createBoardFromTemplatePayloadFn?: typeof createBoardFromTemplatePayload;
  getUserPlanFn?: typeof getUserPlan;
  getEntitlementsFn?: typeof getEntitlements;
};

type TemplateRow = {
  template_id: string;
  owner_user_id: string;
  visibility: "public" | "unlisted" | "hidden";
  pro_only: boolean;
  tier?: "free" | "pro" | null;
  stats: Record<string, unknown> | null;
  payload: SanitizedTemplatePayload | TemplatePayload | null;
  moderation: Record<string, unknown> | null;
  copy_count?: number | null;
  status?: string | null;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function handlePost(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  _requestContext: RequestContext,
  deps?: TemplateInstallDeps,
) {
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;
  const getPlan = deps?.getUserPlanFn ?? getUserPlan;
  const getEntitlement = deps?.getEntitlementsFn ?? getEntitlements;

  let source: "community" | "picks" | "pro_pack" | null = null;
  let collectionSlug: string | null = null;
  try {
    const body = (await request.json()) as { source?: string; collectionSlug?: string };
    source =
      body?.source === "community" || body?.source === "picks" || body?.source === "pro_pack"
        ? body.source
        : null;
    collectionSlug = typeof body?.collectionSlug === "string" ? body.collectionSlug : null;
  } catch {
    source = null;
    collectionSlug = null;
  }

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return jsonError("invalid_template_id", "템플릿 ID 형식이 올바르지 않습니다.");
  }

  const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data, error } = await admin
    .from("templates")
    .select("template_id, owner_user_id, visibility, pro_only, tier, stats, payload, moderation, copy_count, status")
    .eq("template_id", id)
    .maybeSingle<TemplateRow>();

  if (error) {
    return jsonError("template_lookup_failed", error.message, 502);
  }

  if (!data) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  let requiresProPack = source === "pro_pack";

  if (!requiresProPack && collectionSlug) {
    const { data: collectionRow } = await admin
      .from("template_collections")
      .select("kind")
      .eq("slug", collectionSlug)
      .maybeSingle<{ kind: "picks" | "pro_pack" }>();
    if (collectionRow?.kind === "pro_pack") {
      requiresProPack = true;
    }
  }

  if (!requiresProPack) {
    const { data: proPackItems } = await admin
      .from("template_collection_items")
      .select("template_id, template_collections!inner(kind)")
      .eq("template_id", id)
      .eq("template_collections.kind", "pro_pack")
      .limit(1);
    requiresProPack = Boolean(proPackItems?.length);
  }

  if (requiresProPack) {
    const entitlements = await getEntitlement(user.id);
    if (!entitlements.proTemplates) {
      return NextResponse.json(
        { ok: false, error: { code: "pro_locked", message: "Pro 템플릿입니다." } },
        { status: 403 },
      );
    }
  }

  const autoHidden = Boolean((data.moderation as Record<string, unknown> | null | undefined)?.autoHidden);
  if (autoHidden && data.owner_user_id !== user.id) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  if (data.status && data.status !== "active" && data.owner_user_id !== user.id) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  if (data.visibility !== "public" && data.visibility !== "unlisted" && data.owner_user_id !== user.id) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  const plan = await getPlan({ userId: user.id });

  const resolvedTier = (data.tier ?? (data.pro_only ? "pro" : "free")) as "free" | "pro";
  if (resolvedTier === "pro") {
    try {
      assertPro(plan);
    } catch {
      return NextResponse.json(
        { ok: false, code: "pro_required", upgradeUrl: "/dashboard/billing#upgrade" },
        { status: 402 },
      );
    }
  }

  const payload = data.payload;
  if (!payload) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }
  const createFromPayload = deps?.createBoardFromTemplatePayloadFn ?? createBoardFromTemplatePayload;

  let boardId: string;
  try {
    boardId = await createFromPayload(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "보드를 생성하지 못했습니다.";
    return jsonError("template_install_failed", message, 500);
  }

  const stats = (data.stats as { clones?: number; reports?: number } | null | undefined) ?? {};
  const nextStats = {
    ...stats,
    clones: (stats.clones ?? 0) + 1,
    reports: stats.reports ?? 0,
  };
  const nextCopyCount = (data.copy_count ?? 0) + 1;
  await admin
    .from("templates")
    .update({ stats: nextStats, copy_count: nextCopyCount })
    .eq("template_id", id);

  return NextResponse.json({ ok: true, boardId, href: `/dashboard/boards/${boardId}/board` });
}

export const POST = withRequestContext(handlePost);
