"use client";

import { apiV1Path } from "@/lib/standards/pathTypes";

export type DashboardAnalyticsEvent =
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
        | "guided_start_option_view"
        | "guided_start_option_click"
        | "recommended_path_selected"
        | "guided_path_step_view"
        | "guided_path_next_click"
        | "activation_recommendation_dismissed"
        | "first_value_path_complete"
        | "first_board_created"
        | "first_template_started"
        | "first_lesson_started"
        | "classroom_action_cta_click"
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

export function trackDashboardAnalyticsEvent(event: DashboardAnalyticsEvent): void {
  const headers = new Headers({ "content-type": "application/json" });

  void fetch(apiV1Path("dashboard/analytics/events"), {
    method: "POST",
    headers,
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {
    // fail-open: analytics must not block dashboard interactions
  });
}
