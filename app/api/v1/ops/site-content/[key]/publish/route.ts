export const dynamic = "force-dynamic";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isSiteContentKey } from "@/lib/db/siteContent";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps } from "@/lib/ops/withOps";
import { parseBoardSidebarConfig } from "@/lib/site-content/boardSidebarConfig";
import { parseNavConfig } from "@/lib/site-content/navConfig";
import { validateSiteContentBlocks } from "@/lib/site-content/blocks";
import { publishSiteContent } from "@/lib/site-content/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function normalizeIsoOrNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) return undefined;
  return parsed.toISOString();
}

async function requireOpsAdmin() {
  try {
    const { user } = await requireUserApi();
    return !!user.email && isOpsAdmin(user.email);
  } catch {
    return false;
  }
}



async function resolveMediaFile(fileId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const [{ data: boardFile }, { data: fileRow }] = await Promise.all([
    admin.from("board_files").select("id").eq("id", fileId).is("deleted_at", null).maybeSingle(),
    admin.from("files").select("id").eq("id", fileId).eq("status", "ready").is("deleted_at", null).maybeSingle(),
  ]);
  return !!boardFile || !!fileRow;
}

export const POST = withOps(async (request: Request, context: { params: Promise<{ key: string }> }, ops) => {
  if (!(await requireOpsAdmin())) {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", ops.requestId, 401, { hint: "ops admin only" });
  }

  const { key } = await context.params;
  if (!isSiteContentKey(key)) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid key", ops.requestId, 400, { hint: "usage|updates|roadmap|policy|community_usage|community_updates|site_nav_config|board_sidebar_config" });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    body?: unknown;
    bodyBlocks?: unknown;
    note?: unknown;
    publishAt?: unknown;
    expiresAt?: unknown;
  } | null;
  if (!body || typeof body.title !== "string" || typeof body.body !== "string") {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid body", ops.requestId, 400, { hint: "title/body required" });
  }

  if (key === "site_nav_config" && !parseNavConfig(body.body)) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid nav config body", ops.requestId, 400, { hint: "landingFooterLinks/dashboardHelpLinks with safe href" });
  }

  if (key === "board_sidebar_config" && !parseBoardSidebarConfig(body.body)) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid board sidebar config body", ops.requestId, 400, { hint: "tabs/items with allowed ids and safe href" });
  }

  const blocksResult = await validateSiteContentBlocks(body.bodyBlocks, {
    resolveMediaFile: async (fileId) => resolveMediaFile(fileId),
  });
  if (!blocksResult.ok) {
    return jsonErrorWithRequestId("BAD_REQUEST", blocksResult.message, ops.requestId, 400, { hint: "invalid body blocks" });
  }

  const publishAt = normalizeIsoOrNull(body.publishAt);
  const expiresAt = normalizeIsoOrNull(body.expiresAt);
  if (publishAt === undefined || expiresAt === undefined) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid schedule", ops.requestId, 400, { hint: "publishAt/expiresAt must be datetime" });
  }
  if (publishAt && expiresAt && publishAt > expiresAt) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid schedule", ops.requestId, 400, { hint: "publishAt <= expiresAt" });
  }

  const result = await publishSiteContent(key, {
    title: body.title.trim(),
    body: body.body,
    bodyBlocks: blocksResult.blocks,
    note: typeof body.note === "string" ? body.note.slice(0, 200) : undefined,
    publishAt,
    expiresAt,
  });

  if (!result) {
    return jsonErrorWithRequestId("INTERNAL_ERROR", "unexpected", ops.requestId, 500, { hint: "publish" });
  }

  return jsonOkWithRequestId(result, ops.requestId);
}, { log: true, errorCode: ErrorCodes.dbFailed });
