import { trackDashboardAnalyticsEvent } from "@/app/dashboard/dashboardAnalytics";

export type MarketingFunnelEventName =
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

export function trackMarketingFunnelEvent(name: MarketingFunnelEventName, meta?: Record<string, string | number | boolean>) {
  trackDashboardAnalyticsEvent({
    type: "marketing-funnel-event",
    name,
    page: typeof window !== "undefined" ? window.location.pathname : "unknown",
    meta,
  });
}
