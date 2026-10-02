export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import {
  isSiteContentKey,
  isSiteContentStatus,
  type SiteContentKey,
} from "@/lib/db/siteContent";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { validateSiteContentBlocks } from "@/lib/site-content/blocks";
import { parseBoardSidebarConfig } from "@/lib/site-content/boardSidebarConfig";
import { parseNavConfig } from "@/lib/site-content/navConfig";
import { getSiteContentDraft, upsertSiteContentByKey } from "@/lib/site-content/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { routes } from "@/lib/standards/routes";

const ROUTE_NAME = routes.api.ops.siteContentByKey(":key");
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 60;

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

async function requireOpsAdminEmail(): Promise<string | null> {
  try {
    const { user } = await requireUserApi();
    const userEmail = user.email ?? null;
    if (!userEmail || !isOpsAdmin(userEmail)) {
      return null;
    }
    return userEmail;
  } catch {
    return null;
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

async function enforceOpsRateLimit(request: Request, requestId: string) {
  const subject = await getRateLimitSubject(request, null);
  const result = await checkRateLimit(createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0], {
    key: `ops:site-content:${subject}`,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    limit: RATE_LIMIT_MAX,
  });
  if (result.ok) return null;
  return jsonErrorWithRequestId("RATE_LIMITED", "rate limited", requestId, 429, { hint: "ops site-content" });
}

async function handleGet(request: Request, context: { params: Promise<{ key: string }> }, ops: WithOpsContext) {
  const userEmail = await requireOpsAdminEmail();
  if (!userEmail) {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", ops.requestId, 401, { hint: "ops admin only" });
  }

  const limited = await enforceOpsRateLimit(request, ops.requestId);
  if (limited) return limited;

  const { key } = await context.params;
  if (!isSiteContentKey(key)) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid key", ops.requestId, 400, { hint: "usage|updates|roadmap|policy|community_usage|community_updates|site_nav_config|board_sidebar_config" });
  }

  const content = await getSiteContentDraft(key);
  if (!content) {
    return jsonErrorWithRequestId("NOT_FOUND", "not found", ops.requestId, 404, { hint: key });
  }

  return jsonOkWithRequestId({ content }, ops.requestId);
}

async function handlePut(request: Request, context: { params: Promise<{ key: string }> }, ops: WithOpsContext) {
  const userEmail = await requireOpsAdminEmail();
  if (!userEmail) {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", ops.requestId, 401, { hint: "ops admin only" });
  }

  const limited = await enforceOpsRateLimit(request, ops.requestId);
  if (limited) return limited;

  const { key } = await context.params;
  if (!isSiteContentKey(key)) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid key", ops.requestId, 400, { hint: "usage|updates|roadmap|policy|community_usage|community_updates|site_nav_config|board_sidebar_config" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid body", ops.requestId, 400, { hint: "json required" });
  }

  const next = body as Partial<{ title: string; body: string; bodyBlocks?: unknown; status: string; publishAt?: unknown; expiresAt?: unknown }>;
  if (typeof next.title !== "string" || typeof next.body !== "string" || typeof next.status !== "string") {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid body", ops.requestId, 400, { hint: "title/body/status required" });
  }

  if (!isSiteContentStatus(next.status)) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid status", ops.requestId, 400, { hint: "draft|published" });
  }

  const publishAt = normalizeIsoOrNull(next.publishAt);
  const expiresAt = normalizeIsoOrNull(next.expiresAt);
  if (publishAt === undefined || expiresAt === undefined) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid schedule", ops.requestId, 400, { hint: "publishAt/expiresAt must be datetime" });
  }
  if (publishAt && expiresAt && publishAt > expiresAt) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid schedule", ops.requestId, 400, { hint: "publishAt <= expiresAt" });
  }

  if (key === "site_nav_config" && !parseNavConfig(next.body)) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid nav config body", ops.requestId, 400, { hint: "landingFooterLinks/dashboardHelpLinks with safe href" });
  }

  if (key === "board_sidebar_config" && !parseBoardSidebarConfig(next.body)) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid board sidebar config body", ops.requestId, 400, { hint: "tabs/items with allowed ids and safe href" });
  }

  const blocksResult = await validateSiteContentBlocks(next.bodyBlocks, {
    resolveMediaFile: async (fileId) => resolveMediaFile(fileId),
  });
  if (!blocksResult.ok) {
    return jsonErrorWithRequestId("BAD_REQUEST", blocksResult.message, ops.requestId, 400, { hint: "invalid body blocks" });
  }

  const content = await upsertSiteContentByKey({
    key: key as SiteContentKey,
    title: next.title.trim(),
    body: next.body,
    bodyBlocks: blocksResult.blocks,
    status: next.status,
    publishAt,
    expiresAt,
  });

  if (!content) {
    return jsonErrorWithRequestId("INTERNAL_ERROR", "unexpected", ops.requestId, 500, { hint: ROUTE_NAME });
  }

  return jsonOkWithRequestId({ content }, ops.requestId);
}

export const GET = withOps(handleGet, { log: true, errorCode: ErrorCodes.dbFailed });
export const PUT = withOps(handlePut, { log: true, errorCode: ErrorCodes.dbFailed });
