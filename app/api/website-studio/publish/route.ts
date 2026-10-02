import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { apiErrorResponse } from "@/lib/http/apiError";
import { createWebsiteStudioSlug, validatePublishSnapshot } from "@/lib/website-studio/websiteStudioPublish";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return apiErrorResponse("unauthorized", "인증이 필요합니다.", 401, { requestId });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const localSiteId = typeof body?.localSiteId === "string" ? body.localSiteId.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const templateId = typeof body?.templateId === "string" ? body.templateId : "starter";
  const snapshotBody = body?.snapshot as Record<string, unknown> | undefined;
  const snapshot: { html: string; css: string; fullDocument: string } | undefined =
    snapshotBody &&
    typeof snapshotBody.html === "string" &&
    typeof snapshotBody.css === "string" &&
    typeof snapshotBody.fullDocument === "string"
      ? { html: snapshotBody.html, css: snapshotBody.css, fullDocument: snapshotBody.fullDocument }
      : undefined;

  if (!localSiteId || !title || !snapshot) return apiErrorResponse("invalid_request", "요청 정보를 확인해주세요.", 400, { requestId });

  const issue = validatePublishSnapshot(snapshot);
  if (issue) return apiErrorResponse("publish_blocked", "아직 공개할 수 없습니다. 배포 전 점검에서 차단 항목을 먼저 해결해주세요.", 400, { requestId });

  const admin = createSupabaseAdminClient();
  let slug = createWebsiteStudioSlug(title, localSiteId);
  for (let i = 0; i < 4; i += 1) {
    const { data } = await admin.from("website_studio_published_snapshots").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = createWebsiteStudioSlug(title, localSiteId);
  }

  const insertPayload = toSnakeKeys({
    ownerUserId: userId,
    sourceLocalId: localSiteId,
    title,
    slug,
    status: "published",
    snapshotVersion: Number(body?.snapshotVersion) || 1,
    html: snapshot.html,
    css: snapshot.css,
    fullDocument: snapshot.fullDocument,
    safetyStatus: body?.safetyStatus === "ready" ? "ready" : "needs-review",
    safetySummaryJson: body?.safetySummary ?? {},
    templateId,
    originBoardId: body?.originBoardId ?? null,
    originSource: body?.originSource ?? null,
    originDay: body?.originDay ?? null,
    publishedAt: new Date().toISOString(),
  });

  const { data, error } = await admin
    .from("website_studio_published_snapshots")
    .insert(insertPayload as never)
    .select("id,slug")
    .single();
  const published = data as { id: string; slug: string } | null;
  if (error || !published) return apiErrorResponse("publish_failed", "공유 링크를 저장하지 못했습니다.", 500, { requestId });

  return NextResponse.json({ ok: true, publishId: published.id, slug: published.slug, publicUrl: `/w/${published.slug}`, requestId });
}
