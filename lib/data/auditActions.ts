export const AUDIT_ACTIONS = {
  cardCreated: "card_created",
  cardUpdated: "card_updated",
  cardAttachmentAdded: "card_attachment_added",
  cardLinkAdded: "card_link_added",

  dashboardQuickCreateSuccess: "dashboard_quick_create_success",
  dashboardQuickCreateFailed: "dashboard_quick_create_failed",
  dashboardHomeHubV2Viewed: "dashboard_home_hub_v2_viewed",
  dashboardRecentBoardOpenOutcome: "dashboard_recent_board_open_outcome",
  dashboardRecentBoardIdCleared: "dashboard_recent_board_id_cleared",
  dashboardCreateBoardSuccessDispatched: "dashboard_create_board_success_dispatched",
  marketingFunnelEvent: "marketing_funnel_event",

  communityPostStatusChanged: "community_post_status_changed",
  communityCommentStatusChanged: "community_comment_status_changed",
  communityReportStatusChanged: "community_report_status_changed",
  communityUserBlocked: "community_user_blocked",
  communityUserUnblocked: "community_user_unblocked",

  uiPrefsPresetCreated: "ui_prefs_preset_created",
  uiPrefsPresetRenamed: "ui_prefs_preset_renamed",
  uiPrefsPresetDeleted: "ui_prefs_preset_deleted",
  uiPrefsResetByOps: "ui_prefs_reset_by_ops",
  dashboardCustomPageRendered: "dashboard_custom_page_rendered",

  opsRetentionDryRunRequested: "ops_alert_retention_dry_run_requested",
  opsReportsBacklogAssistantPreview: "ops_reports_backlog_assistant_preview",
  opsReportsBacklogAssistantExecute: "ops_reports_backlog_assistant_execute",

  opsUserUiPrefsClearPreviewed: "ops_user_ui_prefs_clear_previewed",
  opsUserUiPrefsClearExecuted: "ops_user_ui_prefs_clear_executed",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
