import { NextResponse } from "next/server";

import { getRequestContext, logAudit } from "@/lib/data/audit";
import { AUDIT_ACTIONS } from "@/lib/data/auditActions";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_LIMIT = 30;

type AnalyticsEventPayload =
  | {
      type: "recent-board-open-outcome";
      outcome: "navigate" | "fallback";
      boardId?: string;
      reason?: "last_opened_board_id_missing";
    }
  | {
      type: "recent-board-id-cleared";
      reason: "forbidden" | "not-found";
      boardId: string;
    }
  | {
      type: "create-board-success-dispatched";
      boardId: string;
    }
  | {
      type: "marketing-funnel-event";
      name:
        | "landing_view"
        | "cta_click"
        | "pricing_view"
        | "pricing_plan_select"
        | "plan_decision_aid_interaction"
        | "billing_modal_open"
        | "upgrade_request_submit"
        | "upgrade_request_success"
        | "upgrade_request_failed"
        | "upgrade_request_cancel"
        | "institution_contact_start"
        | "institution_contact_success"
        | "first_value_start"
        | "onboarding_cta_click"
        | "empty_state_primary_click"
        | "first_board_create_click"
        | "first_template_use_click"
        | "activation_step_complete"
        | "activation_step_skip"
        | "institution_path_view"
        | "institution_path_submit"
        | "upgrade_intent_selected"
        | "role_selected"
        | "inquiry_type_selected"
        | "faq_expand"
        | "signup_start";
      page: string;
      meta?: Record<string, string | number | boolean>;
    };

function jsonRateLimited(retryAfterSeconds: number, requestId: string | null) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      },
      request_id: requestId,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

function parsePayload(input: unknown): AnalyticsEventPayload | null {
  if (!input || typeof input !== "object") return null;

  const type = "type" in input ? input.type : null;
  if (type === "recent-board-open-outcome") {
    const outcome = "outcome" in input ? input.outcome : null;
    const boardId = "boardId" in input && typeof input.boardId === "string" ? input.boardId.trim() : "";
    const reason = "reason" in input ? input.reason : null;

    if (outcome !== "navigate" && outcome !== "fallback") return null;
    if (outcome === "navigate" && boardId.length === 0) return null;
    if (outcome === "fallback" && reason !== "last_opened_board_id_missing") return null;

    return {
      type,
      outcome,
      boardId: boardId.length > 0 ? boardId : undefined,
      reason: reason === "last_opened_board_id_missing" ? reason : undefined,
    };
  }

  if (type === "recent-board-id-cleared") {
    const reason = "reason" in input ? input.reason : null;
    const boardId = "boardId" in input && typeof input.boardId === "string" ? input.boardId.trim() : "";
    if ((reason !== "forbidden" && reason !== "not-found") || boardId.length === 0) return null;

    return { type, reason, boardId };
  }

  if (type === "create-board-success-dispatched") {
    const boardId = "boardId" in input && typeof input.boardId === "string" ? input.boardId.trim() : "";
    if (boardId.length === 0) return null;
    return { type, boardId };
  }

  if (type === "marketing-funnel-event") {
    const name = "name" in input ? input.name : null;
    const page = "page" in input && typeof input.page === "string" ? input.page.trim() : "";
    const meta =
      "meta" in input && input.meta && typeof input.meta === "object" && !Array.isArray(input.meta)
        ? Object.fromEntries(
            Object.entries(input.meta).filter((entry): entry is [string, string | number | boolean] => {
              const value = entry[1];
              return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
            }),
          )
        : undefined;
    const allowedNames = new Set([
      "landing_view",
      "cta_click",
      "pricing_view",
      "pricing_plan_select",
      "plan_decision_aid_interaction",
      "billing_modal_open",
      "upgrade_request_submit",
      "upgrade_request_success",
      "upgrade_request_failed",
      "upgrade_request_cancel",
      "institution_contact_start",
      "institution_contact_success",
      "first_value_start",
      "onboarding_cta_click",
      "empty_state_primary_click",
      "first_board_create_click",
      "first_template_use_click",
      "activation_step_complete",
      "activation_step_skip",
      "institution_path_view",
      "institution_path_submit",
      "upgrade_intent_selected",
      "role_selected",
      "inquiry_type_selected",
      "faq_expand",
      "signup_start",
    ]);
    if (!allowedNames.has(String(name)) || page.length === 0) return null;
    return {
      type,
      name: name as
        | "landing_view"
        | "cta_click"
        | "pricing_view"
        | "pricing_plan_select"
        | "plan_decision_aid_interaction"
        | "billing_modal_open"
        | "upgrade_request_submit"
        | "upgrade_request_success"
        | "upgrade_request_failed"
        | "upgrade_request_cancel"
        | "institution_contact_start"
        | "institution_contact_success"
        | "first_value_start"
        | "onboarding_cta_click"
        | "empty_state_primary_click"
        | "first_board_create_click"
        | "first_template_use_click"
        | "activation_step_complete"
        | "activation_step_skip"
        | "institution_path_view"
        | "institution_path_submit"
        | "upgrade_intent_selected"
        | "role_selected"
        | "inquiry_type_selected"
        | "faq_expand"
        | "signup_start",
      page,
      meta,
    };
  }

  return null;
}

function getAuditWrite(payload: AnalyticsEventPayload): { action: string; boardId?: string; meta: Record<string, unknown> } {
  if (payload.type === "recent-board-open-outcome") {
    return {
      action: AUDIT_ACTIONS.dashboardRecentBoardOpenOutcome,
      boardId: payload.boardId,
      meta: {
        source: "dashboard",
        outcome: payload.outcome,
        ...(payload.reason ? { reason: payload.reason } : {}),
        ...(payload.boardId ? { board_id: payload.boardId } : {}),
      },
    };
  }

  if (payload.type === "recent-board-id-cleared") {
    return {
      action: AUDIT_ACTIONS.dashboardRecentBoardIdCleared,
      boardId: payload.boardId,
      meta: {
        source: "dashboard",
        reason: payload.reason,
        board_id: payload.boardId,
      },
    };
  }

  if (payload.type === "marketing-funnel-event") {
    return {
      action: AUDIT_ACTIONS.marketingFunnelEvent,
      meta: {
        source: "marketing",
        event_name: payload.name,
        page: payload.page,
        ...(payload.meta ? { event_meta: payload.meta } : {}),
      },
    };
  }

  return {
    action: AUDIT_ACTIONS.dashboardCreateBoardSuccessDispatched,
    boardId: payload.boardId,
    meta: {
      source: "dashboard",
      board_id: payload.boardId,
    },
  };
}

export async function handleDashboardAnalyticsEventsPost(request: Request) {
  const requestContext = getRequestContext(request);

  try {
    const subject = await getRateLimitSubject(request);
    const key = `dashboard:analytics:events:${subject}`;
    const limitResult = await checkRateLimit(createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0], {
      key,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      limit: RATE_LIMIT_LIMIT,
    });

    if (!limitResult.ok) {
      return jsonRateLimited(limitResult.retryAfterSeconds, requestContext.requestId);
    }
  } catch {
    // fail-open for telemetry endpoint
  }

  const body = await request.json().catch(() => null);
  const payload = parsePayload(body);
  if (!payload) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_PAYLOAD" }, request_id: requestContext.requestId }, { status: 400 });
  }

  const audit = getAuditWrite(payload);
  try {
    void logAudit({
      action: audit.action,
      boardId: audit.boardId,
      meta: audit.meta,
      ctx: requestContext,
    });
  } catch {
    // fail-open
  }

  return NextResponse.json({ ok: true, request_id: requestContext.requestId }, { status: 200 });
}
