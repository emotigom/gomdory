import "server-only";

import { headers } from "next/headers";

import { normalizeBoardRole, type BoardRole } from "@/lib/auth/boardRoles";
import { getClientIp } from "@/lib/http/fingerprint";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuditLogInput = {
  boardId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
  ctx?: AuditRequestContext;
};

export type AuditRequestContext = {
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
};

function getHeaderValue(source: Headers, key: string): string | null {
  const value = source.get(key);
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getRequestContext(req: Request | Headers): AuditRequestContext {
  const requestHeaders = req instanceof Request ? req.headers : req;
  const requestId = getHeaderValue(requestHeaders, "x-request-id") ?? getHeaderValue(requestHeaders, "cf-ray") ?? getHeaderValue(requestHeaders, "x-cf-ray");
  const forwardedIp = getHeaderValue(requestHeaders, "x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ip = getHeaderValue(requestHeaders, "cf-connecting-ip") ?? forwardedIp ?? getHeaderValue(requestHeaders, "x-real-ip") ?? (req instanceof Request ? getClientIp(req) : null);
  const userAgent = getHeaderValue(requestHeaders, "user-agent");

  return { requestId, ip, userAgent };
}

function normalizeMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  const safeMeta = meta ?? {};

  try {
    const serialized = JSON.stringify(safeMeta);
    if (serialized && serialized.length > 5_000) {
      return { truncated: true };
    }
    return safeMeta;
  } catch {
    return { truncated: true };
  }
}

async function getBoardRole(boardId: string): Promise<BoardRole | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("board_role", { bid: boardId });

  if (error) {
    return null;
  }

  return normalizeBoardRole(data);
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    const [userResult, role] = await Promise.all([
      supabase.auth.getUser(),
      input.boardId ? getBoardRole(input.boardId) : Promise.resolve(null),
    ]);

    const actorUserId = userResult.data.user?.id ?? null;
    const actorRole = normalizeBoardRole(role);
    const meta = normalizeMeta(input.meta);
    const fallbackCtx = getRequestContext(await headers());
    const ctx = input.ctx ?? fallbackCtx;

    // meta schema (community/preset/ops):
    // - community_*: { status?, reason?, moderatorUserId }
    // - ui_prefs_preset_*: { presetName?, presetCount }
    // - ops_community_report_status_changed: { status }
    // - ops_community_target_visibility_changed: { status, reportId }
    // - ops_community_user_block_changed: { operation, reportId }

    await supabase.from("audit_logs").insert({
      board_id: input.boardId ?? null,
      actor_user_id: actorUserId,
      actor_role: actorRole,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      meta,
      request_id: ctx.requestId,
      ip: ctx.ip,
      user_agent: ctx.userAgent,
    });
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          stage: "audit_log_failed",
          boardId: input.boardId ?? null,
          action: input.action,
          message: error instanceof Error ? error.message : String(error),
        },
        (_key, value) => (value === undefined ? undefined : value),
      ),
    );
  }
}
