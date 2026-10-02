export const dynamic = "force-dynamic";

import Link from "next/link";
import OpsDetailPanel from "../_components/OpsDetailPanel";
import OpsTable from "../_components/OpsTable";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateSupabaseEnv } from "@/lib/server/env";
import { PUBLIC_FLAGS_REGISTRY } from "@/lib/dashboard/featureFlags";
import { FEATURE_FLAG_SNAPSHOT } from "@/lib/ops/featureFlagsSnapshot";
import { AUDIT_ACTIONS } from "@/lib/data/auditActions";

import AlertBanners from "./AlertBanners";
import RetentionRunButtons from "./RetentionRunButtons";
import RequestIdCopyButton from "./RequestIdCopyButton";

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  actor_user_id: string | null;
  target_id: string | null;
  request_id: string | null;
  ip: string | null;
  meta: unknown;
};

const DEFAULT_QUICK_CREATE_LIMIT = 50;
const REQUEST_SEARCH_QUICK_CREATE_LIMIT = 10;
const DEFAULT_CUSTOM_PAGE_RENDER_LIMIT = 20;
const REQUEST_SEARCH_CUSTOM_PAGE_RENDER_LIMIT = 10;
const DEFAULT_WAVE2_AUDIT_LIMIT = 50;
const REQUEST_SEARCH_WAVE2_AUDIT_LIMIT = 10;

type QueryError = {
  message: string;
};

type AlertBannerItem = {
  id: string;
  tone: "danger" | "warn";
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
};

type RetentionStatusRow = {
  enabled: boolean;
  run_every_hours: number;
  community_reports_resolved_ttl_days: number;
  audit_logs_ttl_days: number;
  rate_limits_ttl_days: number;
  rate_limit_counters_grace_days: number;
  next_purge_due_at: string;
  last_run_at: string | null;
  last_success: boolean | null;
  last_dry_run: boolean | null;
  last_note: string | null;
  last_community_reports_purged: number | null;
  last_audit_logs_purged: number | null;
  last_rate_limits_purged: number | null;
  last_would_community_reports_purged: number | null;
  last_would_audit_logs_purged: number | null;
  last_would_rate_limits_purged: number | null;
};

const WAVE2_FLAG_CHECKLIST = PUBLIC_FLAGS_REGISTRY.filter((item) => item.wave === 2);
const WAVE2_RUNBOOK_EXECUTION_LOG_LABEL = "Wave2 runbook log";

function getWave2AuditStatusForItem(flagName: string) {
  if (flagName === "NEXT_PUBLIC_DASHBOARD_HOME_HUB_V2") {
    return "home-hub-v2-viewed";
  }
  if (flagName === "NEXT_PUBLIC_DASHBOARD_CUSTOM_PAGE_RENDER_V1") {
    return "custom-page-rendered";
  }
  if (flagName === "NEXT_PUBLIC_DASHBOARD_CUSTOM_PAGES_V2") {
    return "ui-prefs-clear";
  }
  return null;
}

function getWave2AuditHref(flagName: string) {
  const status = getWave2AuditStatusForItem(flagName);
  const basePath = "/dashboard/ops/system-jobs";
  const hash = SECTION_ANCHORS.wave2Audit;
  if (!status) {
    return `${basePath}${hash}`;
  }
  return `${basePath}?wave2AuditStatus=${encodeURIComponent(status)}${hash}`;
}

const OPEN_REPORTS_THRESHOLD = 50;
const BLOCKED_USERS_24H_THRESHOLD = 10;
const RETENTION_STALE_HOURS = 48;
const UI_PREFS_SPIKE_24H_THRESHOLD = 30;

const SECTION_ANCHORS = {
  alerts: "#alerts",
  featureFlagsSnapshot: "#feature-flags-snapshot",
  wave2FlagsChecklist: "#wave2-flags-checklist",
  retentionStatus: "#retention-status",
  communityModerationAudit: "#community-moderation-audit",
  uiPrefsAudit: "#ui-prefs-audit",
  customPageRenderAudit: "#dashboard-custom-page-render-audit",
  quickCreateAudit: "#quick-create-audit",
  wave2Audit: "#wave2-audit",
} as const;

const SECTION_IDS = {
  alerts: SECTION_ANCHORS.alerts.replace("#", ""),
  featureFlagsSnapshot: SECTION_ANCHORS.featureFlagsSnapshot.replace("#", ""),
  wave2FlagsChecklist: SECTION_ANCHORS.wave2FlagsChecklist.replace("#", ""),
  retentionStatus: SECTION_ANCHORS.retentionStatus.replace("#", ""),
  communityModerationAudit: SECTION_ANCHORS.communityModerationAudit.replace("#", ""),
  uiPrefsAudit: SECTION_ANCHORS.uiPrefsAudit.replace("#", ""),
  customPageRenderAudit: SECTION_ANCHORS.customPageRenderAudit.replace("#", ""),
  quickCreateAudit: SECTION_ANCHORS.quickCreateAudit.replace("#", ""),
  wave2Audit: SECTION_ANCHORS.wave2Audit.replace("#", ""),
} as const;

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ko-KR");
}

function summarizeIp(ip: string | null | undefined) {
  if (!ip) return "—";
  if (ip.includes(".")) {
    const segments = ip.split(".");
    if (segments.length === 4) {
      return `${segments[0]}.${segments[1]}.${segments[2]}.*`;
    }
  }
  if (ip.includes(":")) {
    const segments = ip.split(":").filter(Boolean);
    return `${segments.slice(0, 3).join(":")}:*`;
  }
  return ip;
}

function summarizeMeta(meta: unknown) {
  if (!meta) return "—";
  if (typeof meta === "string") {
    return meta.length > 90 ? `${meta.slice(0, 90)}…` : meta;
  }
  try {
    const encoded = JSON.stringify(meta);
    if (!encoded) return "—";
    return encoded.length > 120 ? `${encoded.slice(0, 120)}…` : encoded;
  } catch {
    return "[unserializable meta]";
  }
}

function mapAuditActionFilter(value: string) {
  switch (value) {
    case "created":
      return "ui_prefs_preset_created";
    case "renamed":
      return "ui_prefs_preset_renamed";
    case "deleted":
      return "ui_prefs_preset_deleted";
    case "ui_prefs_*":
      return null;
    default:
      return null;
  }
}


function mapQuickCreateActionFilter(value: string) {
  switch (value) {
    case "success":
      return "dashboard_quick_create_success";
    case "failed":
      return "dashboard_quick_create_failed";
    default:
      return null;
  }
}

function mapWave2ActionFilter(value: string) {
  switch (value) {
    case "success":
      return [
        AUDIT_ACTIONS.dashboardQuickCreateSuccess,
        AUDIT_ACTIONS.dashboardHomeHubV2Viewed,
        AUDIT_ACTIONS.dashboardCreateBoardSuccessDispatched,
      ];
    case "failed":
      return [AUDIT_ACTIONS.dashboardQuickCreateFailed];
    case "home-hub-v2-viewed":
      return [AUDIT_ACTIONS.dashboardHomeHubV2Viewed];
    case "custom-page-rendered":
      return [AUDIT_ACTIONS.dashboardCustomPageRendered];
    case "ui-prefs-clear":
      return [AUDIT_ACTIONS.opsUserUiPrefsClearPreviewed, AUDIT_ACTIONS.opsUserUiPrefsClearExecuted];
    default:
      return [
        AUDIT_ACTIONS.dashboardQuickCreateSuccess,
        AUDIT_ACTIONS.dashboardQuickCreateFailed,
        AUDIT_ACTIONS.dashboardHomeHubV2Viewed,
        AUDIT_ACTIONS.dashboardRecentBoardOpenOutcome,
        AUDIT_ACTIONS.dashboardRecentBoardIdCleared,
        AUDIT_ACTIONS.dashboardCreateBoardSuccessDispatched,
        AUDIT_ACTIONS.dashboardCustomPageRendered,
        AUDIT_ACTIONS.opsUserUiPrefsClearPreviewed,
        AUDIT_ACTIONS.opsUserUiPrefsClearExecuted,
      ];
  }
}

export default async function OpsSystemJobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const auditActionFilter = String(params.auditAction ?? "all");
  const auditWindow = String(params.auditWindow ?? "24h");
  const quickCreateActionFilter = String(params.quickCreateAction ?? "all");
  const quickCreateWindow = String(params.quickCreateWindow ?? "24h");
  const customPageRenderWindow = String(params.customPageRenderWindow ?? "24h");
  const wave2AuditWindow = String(params.wave2AuditWindow ?? "24h");
  const wave2AuditStatus = String(params.wave2AuditStatus ?? "all");
  const wave2RequestIdRaw = getSingleSearchParam(params.wave2RequestId) ?? getSingleSearchParam(params.q) ?? "";
  const wave2RequestIdFilter = wave2RequestIdRaw.trim();
  const isWave2RequestSearch = wave2RequestIdFilter.length > 0;
  const customPageRenderRequestIdRaw = getSingleSearchParam(params.customPageRenderRequestId) ?? getSingleSearchParam(params.q) ?? "";
  const customPageRenderRequestIdFilter = customPageRenderRequestIdRaw.trim();
  const isCustomPageRenderRequestSearch = customPageRenderRequestIdFilter.length > 0;
  const quickCreateRequestIdRaw = getSingleSearchParam(params.quickCreateRequestId) ?? getSingleSearchParam(params.q) ?? "";
  const quickCreateRequestIdFilter = quickCreateRequestIdRaw.trim();
  const isQuickCreateRequestSearch = quickCreateRequestIdFilter.length > 0;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const blockedUsersSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const auditSince =
    auditWindow === "7d"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const quickCreateSince =
    quickCreateWindow === "7d"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const customPageRenderSince =
    customPageRenderWindow === "7d"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const wave2AuditSince =
    wave2AuditWindow === "7d"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const featureFlags = FEATURE_FLAG_SNAPSHOT.map((flag) => {
    const raw = process.env[flag.key];
    return {
      ...flag,
      raw: raw ?? "(unset)",
      enabled: raw === "1",
      fallbackSafe: "OFF(0/미설정)에서도 기존 UI로 폴백",
      defaultValue: "OFF",
      rollback: "0 또는 미설정",
    };
  });

  let errors: { count: number | null } & QueryError = { count: 0, message: "" };
  let openReports: { count: number | null } & QueryError = { count: 0, message: "" };
  let blockedUsersIn24h: { count: number | null } & QueryError = { count: 0, message: "" };
  let pendingOwnership: { data: Array<{ id: string; board_id: string | null; student_name: string | null; created_at: string | null }> | null } & QueryError = { data: [], message: "" };
  let pendingQuestions: { data: Array<{ id: string; board_id: string | null; status: string | null; created_at: string | null }> | null } & QueryError = { data: [], message: "" };
  let communityAuditLogs: { data: Array<{ id: string; action: string; target_type: string | null; target_id: string | null; actor_user_id: string | null; created_at: string }> | null } & QueryError = { data: [], message: "" };
  let uiPrefsAuditLogs: { data: AuditRow[] | null } & QueryError = { data: [], message: "" };
  let customPageRenderAuditLogs: { data: AuditRow[] | null } & QueryError = { data: [], message: "" };
  let quickCreateAuditLogs: { data: AuditRow[] | null } & QueryError = { data: [], message: "" };
  let retentionStatus: { data: RetentionStatusRow[] | null } & QueryError = { data: [], message: "" };
  let wave2AuditLogs: { data: AuditRow[] | null } & QueryError = { data: [], message: "" };

  const supabaseEnv = validateSupabaseEnv({ requireAnonKey: false, requireServiceRoleKey: true });

  try {
    const admin = createSupabaseAdminClient();
    const uiAction = mapAuditActionFilter(auditActionFilter);
    const quickCreateAction = mapQuickCreateActionFilter(quickCreateActionFilter);
    const wave2Actions = mapWave2ActionFilter(wave2AuditStatus);
    let uiPrefsQuery = admin
      .from("audit_logs")
      .select("id, created_at, action, actor_user_id, target_id, request_id, ip, meta")
      .like("action", "ui_prefs_%")
      .gte("created_at", auditSince)
      .order("created_at", { ascending: false })
      .limit(50);
    let quickCreateQuery = admin
      .from("audit_logs")
      .select("id, created_at, action, actor_user_id, target_id, request_id, ip, meta")
      .in("action", ["dashboard_quick_create_success", "dashboard_quick_create_failed"])
      .gte("created_at", quickCreateSince)
      .order("created_at", { ascending: false })
      .limit(isQuickCreateRequestSearch ? REQUEST_SEARCH_QUICK_CREATE_LIMIT : DEFAULT_QUICK_CREATE_LIMIT);
    const customPageRenderQuery = admin
      .from("audit_logs")
      .select("id, created_at, action, actor_user_id, target_id, request_id, ip, meta")
      .eq("action", AUDIT_ACTIONS.dashboardCustomPageRendered)
      .gte("created_at", customPageRenderSince)
      .order("created_at", { ascending: false })
      .limit(isCustomPageRenderRequestSearch ? REQUEST_SEARCH_CUSTOM_PAGE_RENDER_LIMIT : DEFAULT_CUSTOM_PAGE_RENDER_LIMIT);
    let wave2AuditQuery = admin
      .from("audit_logs")
      .select("id, created_at, action, actor_user_id, target_id, request_id, ip, meta")
      .in("action", wave2Actions)
      .gte("created_at", wave2AuditSince)
      .order("created_at", { ascending: false })
      .limit(isWave2RequestSearch ? REQUEST_SEARCH_WAVE2_AUDIT_LIMIT : DEFAULT_WAVE2_AUDIT_LIMIT);

    if (uiAction) {
      uiPrefsQuery = uiPrefsQuery.eq("action", uiAction);
    }

    if (quickCreateAction) {
      quickCreateQuery = quickCreateQuery.eq("action", quickCreateAction);
    }

    if (isQuickCreateRequestSearch) {
      if (quickCreateRequestIdFilter.includes("%") || quickCreateRequestIdFilter.includes("_")) {
        quickCreateQuery = quickCreateQuery.ilike("request_id", quickCreateRequestIdFilter);
      } else {
        quickCreateQuery = quickCreateQuery.eq("request_id", quickCreateRequestIdFilter);
      }
    }

    let customPageRenderQueryFiltered = customPageRenderQuery;
    if (isCustomPageRenderRequestSearch) {
      if (customPageRenderRequestIdFilter.includes("%") || customPageRenderRequestIdFilter.includes("_")) {
        customPageRenderQueryFiltered = customPageRenderQueryFiltered.ilike("request_id", customPageRenderRequestIdFilter);
      } else {
        customPageRenderQueryFiltered = customPageRenderQueryFiltered.eq("request_id", customPageRenderRequestIdFilter);
      }
    }

    if (isWave2RequestSearch) {
      if (wave2RequestIdFilter.includes("%") || wave2RequestIdFilter.includes("_")) {
        wave2AuditQuery = wave2AuditQuery.ilike("request_id", wave2RequestIdFilter);
      } else {
        wave2AuditQuery = wave2AuditQuery.eq("request_id", wave2RequestIdFilter);
      }
    }

    const [errorsRaw, openReportsRaw, blockedUsersRaw, ownershipRaw, questionsRaw, communityRaw, uiPrefsRaw, customPageRenderRaw, quickCreateRaw, retentionRaw, wave2Raw] = await Promise.all([
      admin.from("ops_events").select("id", { count: "exact", head: true }).in("level", ["error", "warn"]).gte("ts", since),
      admin.from("community_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      admin.from("community_blocked_users").select("id", { count: "exact", head: true }).gte("created_at", blockedUsersSince),
      admin.from("ownership_requests").select("id, board_id, student_name, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
      admin.from("class_session_questions").select("id, board_id, status, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
      admin
        .from("audit_logs")
        .select("id, action, target_type, target_id, actor_user_id, created_at")
        .like("action", "community_%")
        .order("created_at", { ascending: false })
        .limit(30),
      uiPrefsQuery,
      customPageRenderQueryFiltered,
      quickCreateQuery,
      admin.rpc("get_ops_retention_status"),
      wave2AuditQuery,
    ]);

    errors = { count: errorsRaw.count, message: errorsRaw.error?.message ?? "" };
    openReports = { count: openReportsRaw.count, message: openReportsRaw.error?.message ?? "" };
    blockedUsersIn24h = { count: blockedUsersRaw.count, message: blockedUsersRaw.error?.message ?? "" };
    pendingOwnership = { data: ownershipRaw.data, message: ownershipRaw.error?.message ?? "" };
    pendingQuestions = { data: questionsRaw.data, message: questionsRaw.error?.message ?? "" };
    communityAuditLogs = { data: communityRaw.data, message: communityRaw.error?.message ?? "" };
    uiPrefsAuditLogs = { data: (uiPrefsRaw.data as AuditRow[] | null) ?? [], message: uiPrefsRaw.error?.message ?? "" };
    customPageRenderAuditLogs = {
      data: (customPageRenderRaw.data as AuditRow[] | null) ?? [],
      message: customPageRenderRaw.error?.message ?? "",
    };
    quickCreateAuditLogs = { data: (quickCreateRaw.data as AuditRow[] | null) ?? [], message: quickCreateRaw.error?.message ?? "" };
    retentionStatus = { data: (retentionRaw.data as RetentionStatusRow[] | null) ?? [], message: retentionRaw.error?.message ?? "" };
    wave2AuditLogs = { data: (wave2Raw.data as AuditRow[] | null) ?? [], message: wave2Raw.error?.message ?? "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    errors.message = message;
    openReports.message = message;
    blockedUsersIn24h.message = message;
    pendingOwnership.message = message;
    pendingQuestions.message = message;
    communityAuditLogs.message = message;
    uiPrefsAuditLogs.message = message;
    customPageRenderAuditLogs.message = message;
    quickCreateAuditLogs.message = message;
    retentionStatus.message = message;
    wave2AuditLogs.message = message;
  }

  const retention = retentionStatus.data?.[0] ?? null;
  const retentionRunAgeMs = retention?.last_run_at ? Date.now() - new Date(retention.last_run_at).getTime() : Number.POSITIVE_INFINITY;
  const isRetentionRunStale = retentionRunAgeMs > RETENTION_STALE_HOURS * 60 * 60 * 1000;
  const isSmallRetentionWindow =
    retention != null && (retention.rate_limits_ttl_days <= 1 || retention.rate_limit_counters_grace_days <= 1);

  const alertBanners: AlertBannerItem[] = [];

  if (!supabaseEnv.ok) {
    alertBanners.push({
      id: "supabase-env-missing",
      tone: "danger",
      title: "Supabase env missing",
      description: `필수 환경변수가 없어 일부 운영 데이터가 비활성화되었습니다. (${supabaseEnv.message})`,
      href: `/dashboard/ops/system-jobs${SECTION_ANCHORS.featureFlagsSnapshot}`,
      hrefLabel: "ops 패널 설정 확인",
    });
  }

  if (openReports.message) {
    alertBanners.push({
      id: "open-reports-data-unavailable",
      tone: "warn",
      title: "미처리 reports 데이터 접근 불가",
      description: `현재 미처리 reports 수를 불러오지 못했습니다. (${openReports.message})`,
      href: "/dashboard/ops/reports?status=open",
      hrefLabel: "reports 화면으로 이동",
    });
  } else if ((openReports.count ?? 0) > OPEN_REPORTS_THRESHOLD) {
    alertBanners.push({
      id: "open-reports-threshold",
      tone: "danger",
      title: "미처리 reports 임계치 초과",
      description: `open reports ${(openReports.count ?? 0).toLocaleString("ko-KR")}건 (임계치 ${OPEN_REPORTS_THRESHOLD}건)을 초과했습니다.`,
      href: "/dashboard/ops/reports?status=open",
      hrefLabel: "open reports 바로가기",
    });
  }

  if (blockedUsersIn24h.message) {
    alertBanners.push({
      id: "blocked-users-data-unavailable",
      tone: "warn",
      title: "차단 사용자 증가 데이터 접근 불가",
      description: `최근 24시간 차단 사용자 증가량을 불러오지 못했습니다. (${blockedUsersIn24h.message})`,
      href: `/dashboard/ops/system-jobs${SECTION_ANCHORS.communityModerationAudit}`,
      hrefLabel: "커뮤니티 감사 로그 보기",
    });
  } else if ((blockedUsersIn24h.count ?? 0) > BLOCKED_USERS_24H_THRESHOLD) {
    alertBanners.push({
      id: "blocked-users-threshold",
      tone: "warn",
      title: "최근 24시간 차단 사용자 급증",
      description: `최근 24시간 신규 차단 ${(blockedUsersIn24h.count ?? 0).toLocaleString("ko-KR")}건 (임계치 ${BLOCKED_USERS_24H_THRESHOLD}건)입니다.`,
      href: `/dashboard/ops/system-jobs${SECTION_ANCHORS.communityModerationAudit}`,
      hrefLabel: "차단/신고 관련 로그 확인",
    });
  }

  if (retentionStatus.message) {
    alertBanners.push({
      id: "retention-status-data-unavailable",
      tone: "warn",
      title: "Retention 상태 데이터 접근 불가",
      description: `최근 실행 상태를 불러오지 못했습니다. (${retentionStatus.message})`,
      href: `/dashboard/ops/system-jobs${SECTION_ANCHORS.retentionStatus}`,
      hrefLabel: "retention 상태로 이동",
    });
  } else if (!retention || retention.last_success === false || isRetentionRunStale) {
    const retentionProblem = !retention
      ? "상태가 비어 있음"
      : retention.last_success === false
        ? "최근 실행 실패"
        : `최근 실행 ${(retention.last_run_at && formatDate(retention.last_run_at)) || "없음"} (48시간 초과)`;

    alertBanners.push({
      id: "retention-job-risk",
      tone: "danger",
      title: "Retention job 점검 필요",
      description: `retention job이 위험 상태입니다: ${retentionProblem}`,
      href: `/dashboard/ops/system-jobs${SECTION_ANCHORS.retentionStatus}`,
      hrefLabel: "retention 상태 확인",
    });
  }

  if (!uiPrefsAuditLogs.message && auditWindow === "24h" && (uiPrefsAuditLogs.data?.length ?? 0) > UI_PREFS_SPIKE_24H_THRESHOLD) {
    alertBanners.push({
      id: "ui-prefs-spike",
      tone: "warn",
      title: "최근 UI prefs 액션 급증",
      description: `최근 24시간 UI prefs 관련 감사 로그 ${(uiPrefsAuditLogs.data?.length ?? 0).toLocaleString("ko-KR")}건입니다.`,
      href: "/dashboard/ops/system-jobs?auditAction=ui_prefs_*&auditWindow=24h#ui-prefs-audit",
      hrefLabel: "UI prefs 감사 로그로 이동",
    });
  }

  const retentionDryRunLabel = retention?.last_dry_run == null ? "—" : retention.last_dry_run ? "DRY-RUN (미실행)" : "LIVE RUN (실행)";
  const smallTtlBlockReason = isSmallRetentionWindow
    ? `rate_limits_ttl_days=${retention?.rate_limits_ttl_days ?? "—"}, rate_limit_counters_grace_days=${retention?.rate_limit_counters_grace_days ?? "—"} (최소 2일 필요)`
    : null;

  return (
    <main className="space-y-4">
      <nav className="rounded-xl border border-slate-200 bg-white px-4 py-3" aria-label="system-jobs quick links">
        <p className="text-xs font-semibold text-slate-600">바로가기</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <a className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50" href={SECTION_ANCHORS.alerts}>#alerts</a>
          <a className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50" href={SECTION_ANCHORS.featureFlagsSnapshot}>#feature-flags-snapshot</a>
          <a className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50" href={SECTION_ANCHORS.wave2FlagsChecklist}>#wave2-flags-checklist</a>
          <a className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50" href={SECTION_ANCHORS.retentionStatus}>#retention-status</a>
          <a className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50" href={SECTION_ANCHORS.uiPrefsAudit}>#ui-prefs-audit</a>
          <a className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50" href={SECTION_ANCHORS.customPageRenderAudit}>#custom-page-render-audit</a>
          <a className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50" href={SECTION_ANCHORS.quickCreateAudit}>#quick-create-audit</a>
          <a className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50" href={SECTION_ANCHORS.wave2Audit}>#wave2-audit</a>
        </div>
      </nav>

      {alertBanners.length > 0 ? <AlertBanners banners={alertBanners} /> : null}

      <OpsDetailPanel title="System health (최소)">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">최근 1시간 에러/경고</p>
            <p className="text-2xl font-bold text-slate-900">{errors.count ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">소유권 요청 대기</p>
            <p className="text-2xl font-bold text-slate-900">{pendingOwnership.data?.length ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">질문 검토 대기</p>
            <p className="text-2xl font-bold text-slate-900">{pendingQuestions.data?.length ?? 0}</p>
          </div>
        </div>
      </OpsDetailPanel>

      <section id="feature-flags-snapshot">
        <OpsDetailPanel title="Feature flags snapshot">
        <OpsTable>
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">flag</th>
              <th className="px-3 py-2">current</th>
              <th className="px-3 py-2">notes</th>
            </tr>
          </thead>
          <tbody>
            {featureFlags.map((flag) => (
              <tr
                key={flag.key}
                className="border-t border-slate-100 align-top"
                data-flag-name={flag.key}
                data-flag-state={flag.enabled ? "on" : "off"}
              >
                <td className="px-3 py-2 text-xs font-medium text-slate-900">{flag.key}</td>
                <td className="px-3 py-2 text-xs text-slate-700">
                  {flag.raw}
                  <span className="ml-2 text-[11px] text-slate-500">({flag.enabled ? "ON" : "OFF"})</span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {flag.meaning} · 기본값 {flag.defaultValue} · 롤백 {flag.rollback} · {flag.fallbackSafe}
                </td>
              </tr>
            ))}
          </tbody>
        </OpsTable>
        </OpsDetailPanel>
      </section>

      <section id="wave2-flags-checklist">
        <OpsDetailPanel
          title="Wave2 enable checklist"
          headerRight={
            <p className="text-xs text-slate-600" aria-label={WAVE2_RUNBOOK_EXECUTION_LOG_LABEL}>
              {WAVE2_RUNBOOK_EXECUTION_LOG_LABEL}: 운영자 문서 경로 규칙에 따라 런타임 직접 링크 대신
              <span className="ml-1 font-medium text-slate-700">docs/ROLL_OUT_DASHBOARD_WAVE_2.md#6-execution-log-append-only</span>
              를 확인하세요.
            </p>
          }
        >
          <OpsTable>
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">flagName</th>
                <th className="px-3 py-2">enabledWhen</th>
                <th className="px-3 py-2">current</th>
                <th className="px-3 py-2">Expected markers (ON/OFF)</th>
                <th className="px-3 py-2">Check path</th>
                <th className="px-3 py-2">Open</th>
                <th className="px-3 py-2">Audit</th>
              </tr>
            </thead>
            <tbody>
              {WAVE2_FLAG_CHECKLIST.map((item) => {
                const raw = process.env[item.flagName];
                const enabled = raw === "1";
                return (
                  <tr key={`wave2-${item.flagName}`} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 text-xs font-medium text-slate-900">{item.flagName}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{item.enabledWhen}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {enabled ? "ON" : "OFF"}
                      <span className="ml-2 text-[11px] text-slate-500">({raw ?? "(unset)"})</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      <div>ON: {item.domMarkerOn}</div>
                      <div>OFF: {item.domMarkerOff}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">{item.smokePath}</code>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      <Link href={item.smokePath} className="text-blue-700 underline underline-offset-2 hover:text-blue-800">
                        Open
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      <Link href={getWave2AuditHref(item.flagName)} className="text-blue-700 underline underline-offset-2 hover:text-blue-800">
                        Audit
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {WAVE2_FLAG_CHECKLIST.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td colSpan={7} className="px-3 py-3 text-xs text-slate-500">
                    wave2 플래그가 registry에 정의되지 않았습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </OpsTable>
        </OpsDetailPanel>
      </section>

      <section id="retention-status">
        <OpsDetailPanel title="Data retention (TTL/archival)">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">다음 purge 예정</p>
            <p className="text-sm font-semibold text-slate-900">{formatDate(retention?.next_purge_due_at)}</p>
            <p className="mt-1 text-[11px] text-slate-500">주기 {retention?.run_every_hours ?? "—"}시간 · {retention?.enabled === false ? "비활성" : "활성"}</p>
            <p className="mt-1 text-[11px] text-slate-500">TTL reports {retention?.community_reports_resolved_ttl_days ?? "—"}d · audit {retention?.audit_logs_ttl_days ?? "—"}d · rate {retention?.rate_limits_ttl_days ?? "—"}d/{retention?.rate_limit_counters_grace_days ?? "—"}d</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">최근 purge 실행</p>
            <p className="text-sm font-semibold text-slate-900">{formatDate(retention?.last_run_at)}</p>
            <p className="mt-1 text-[11px] text-slate-500">결과 {retention?.last_success == null ? "—" : retention.last_success ? "성공" : "실패"}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-700">런 타입 {retentionDryRunLabel}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">최근 purge/would_* 건수</p>
            <table className="mt-1 w-full text-left text-[11px] text-slate-700">
              <thead>
                <tr className="text-slate-500">
                  <th className="pr-2">항목</th>
                  <th className="pr-2">executed</th>
                  <th>would_*</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pr-2">reports</td>
                  <td className="pr-2">{retention?.last_community_reports_purged ?? 0}</td>
                  <td>{retention?.last_would_community_reports_purged ?? 0}</td>
                </tr>
                <tr>
                  <td className="pr-2">audit_logs</td>
                  <td className="pr-2">{retention?.last_audit_logs_purged ?? 0}</td>
                  <td>{retention?.last_would_audit_logs_purged ?? 0}</td>
                </tr>
                <tr>
                  <td className="pr-2">rate_limits</td>
                  <td className="pr-2">{retention?.last_rate_limits_purged ?? 0}</td>
                  <td>{retention?.last_would_rate_limits_purged ?? 0}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-slate-500">{retention?.last_note ?? "—"}</p>
          </div>
        </div>
        {isSmallRetentionWindow ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            보호 경고: rate TTL이 너무 작아 런이 차단됩니다. 사유: {smallTtlBlockReason}
          </p>
        ) : null}
        <RetentionRunButtons />
        </OpsDetailPanel>
      </section>

      <OpsDetailPanel title="Pending ownership jobs">
        <OpsTable>
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr><th className="px-3 py-2">board</th><th className="px-3 py-2">student</th><th className="px-3 py-2">created</th></tr>
          </thead>
          <tbody>
            {(pendingOwnership.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 text-xs">{row.board_id}</td><td className="px-3 py-2 text-xs">{row.student_name}</td><td className="px-3 py-2 text-xs">{formatDate(row.created_at)}</td></tr>
            ))}
          </tbody>
        </OpsTable>
      </OpsDetailPanel>

      <section id="community-moderation-audit">
        <OpsDetailPanel title="Community moderation audit (최근 30건)">
        <OpsTable>
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">created</th>
              <th className="px-3 py-2">action</th>
              <th className="px-3 py-2">target</th>
              <th className="px-3 py-2">actor</th>
            </tr>
          </thead>
          <tbody>
            {(communityAuditLogs.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-xs">{formatDate(row.created_at)}</td>
                <td className="px-3 py-2 text-xs">{row.action}</td>
                <td className="px-3 py-2 text-xs">{row.target_type}:{row.target_id}</td>
                <td className="px-3 py-2 text-xs">{row.actor_user_id ?? "system"}</td>
              </tr>
            ))}
            {(communityAuditLogs.data?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-3 py-3 text-xs text-slate-500" colSpan={4}>기록이 없습니다.</td>
              </tr>
            ) : null}
          </tbody>
        </OpsTable>
        </OpsDetailPanel>
      </section>

      <section id={SECTION_IDS.uiPrefsAudit}>
        <OpsDetailPanel title="UI prefs audit (최근 50건)">
        <form action="/dashboard/ops/system-jobs" className="mb-3 flex flex-wrap items-end gap-2">
          <select name="auditAction" defaultValue={auditActionFilter} className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
            <option value="all">액션 전체</option>
            <option value="ui_prefs_*">ui_prefs_*</option>
            <option value="created">created</option>
            <option value="renamed">renamed</option>
            <option value="deleted">deleted</option>
          </select>
          <select name="auditWindow" defaultValue={auditWindow} className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
            <option value="24h">최근 24시간</option>
            <option value="7d">최근 7일</option>
          </select>
          <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold">적용</button>
        </form>
        {uiPrefsAuditLogs.message ? (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            UI prefs audit를 불러오지 못했습니다. ({uiPrefsAuditLogs.message})
          </p>
        ) : null}
        <OpsTable>
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">created_at</th>
              <th className="px-3 py-2">action</th>
              <th className="px-3 py-2">actor(user_id)</th>
              <th className="px-3 py-2">target_id</th>
              <th className="px-3 py-2">request_id</th>
              <th className="px-3 py-2">ip 요약</th>
              <th className="px-3 py-2">meta 요약</th>
            </tr>
          </thead>
          <tbody>
            {(uiPrefsAuditLogs.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 text-xs">{formatDate(row.created_at)}</td>
                <td className="px-3 py-2 text-xs">{row.action}</td>
                <td className="px-3 py-2 text-xs">{row.actor_user_id ?? "system"}</td>
                <td className="px-3 py-2 text-xs">{row.target_id ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{row.request_id ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{summarizeIp(row.ip)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{summarizeMeta(row.meta)}</td>
              </tr>
            ))}
            {(uiPrefsAuditLogs.data?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-3 py-3 text-xs text-slate-500" colSpan={7}>조건에 맞는 기록이 없습니다.</td>
              </tr>
            ) : null}
          </tbody>
        </OpsTable>
        </OpsDetailPanel>
      </section>

      <section id={SECTION_IDS.customPageRenderAudit}>
        <OpsDetailPanel
          title={`Dashboard custom page render audit (${isCustomPageRenderRequestSearch ? "request_id 검색 최대 10건" : "최근 20건"})`}
        >
          <form action="/dashboard/ops/system-jobs" className="mb-3 flex flex-wrap items-end gap-2">
            <select name="customPageRenderWindow" defaultValue={customPageRenderWindow} className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
              <option value="24h">최근 24시간</option>
              <option value="7d">최근 7일</option>
            </select>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              request_id (customPageRenderRequestId / q)
              <input
                name="customPageRenderRequestId"
                defaultValue={customPageRenderRequestIdFilter}
                placeholder="예: req_123... 또는 %req_123%"
                className="w-72 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
            </label>
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold">적용</button>
            <Link className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50" href="/dashboard/me">
              Open /dashboard/me (flag ON 필요)
            </Link>
          </form>
          {isCustomPageRenderRequestSearch ? (
            <p className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              검색 모드: request_id=<code>{customPageRenderRequestIdFilter}</code> (최대 {REQUEST_SEARCH_CUSTOM_PAGE_RENDER_LIMIT}건)
            </p>
          ) : null}
          {customPageRenderAuditLogs.message ? (
            <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Custom page render audit를 불러오지 못했습니다. ({customPageRenderAuditLogs.message})
            </p>
          ) : null}
          <OpsTable>
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">created_at</th>
                <th className="px-3 py-2">action</th>
                <th className="px-3 py-2">actor(user_id)</th>
                <th className="px-3 py-2">target_id</th>
                <th className="px-3 py-2">request_id</th>
                <th className="px-3 py-2">meta 요약</th>
              </tr>
            </thead>
            <tbody>
              {(customPageRenderAuditLogs.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 text-xs">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2 text-xs">{row.action}</td>
                  <td className="px-3 py-2 text-xs">{row.actor_user_id ?? "system"}</td>
                  <td className="px-3 py-2 text-xs">{row.target_id ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.request_id ? (
                      <div className="flex items-center gap-2">
                        <code className="select-text">{row.request_id}</code>
                        <RequestIdCopyButton requestId={row.request_id} />
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{summarizeMeta(row.meta)}</td>
                </tr>
              ))}
              {(customPageRenderAuditLogs.data?.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-xs text-slate-500" colSpan={6}>조건에 맞는 기록이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </OpsTable>
        </OpsDetailPanel>
      </section>

      <section id="wave2-audit">
        <OpsDetailPanel title={`Wave 2 audits (${isWave2RequestSearch ? "request_id 검색 최대 10건" : "최근 50건"})`}>
          <form action="/dashboard/ops/system-jobs" className="mb-3 flex flex-wrap items-end gap-2">
            <select name="wave2AuditWindow" defaultValue={wave2AuditWindow} className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
              <option value="24h">최근 24시간</option>
              <option value="7d">최근 7일</option>
            </select>
            <select name="wave2AuditStatus" defaultValue={wave2AuditStatus} className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
              <option value="all">전체</option>
              <option value="success">success bucket (dashboard_quick_create_success + dashboard_home_hub_v2_viewed)</option>
              <option value="failed">quick create failed</option>
              <option value="home-hub-v2-viewed">dashboard_home_hub_v2_viewed only</option>
              <option value="custom-page-rendered">custom page rendered</option>
              <option value="ui-prefs-clear">ops_user_ui_prefs_clear_*</option>
            </select>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              request_id (wave2RequestId / q)
              <input
                name="wave2RequestId"
                defaultValue={wave2RequestIdFilter}
                placeholder="예: req_123... 또는 %req_123%"
                className="w-72 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
            </label>
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold">적용</button>
          </form>
          {isWave2RequestSearch ? (
            <p className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              검색 모드: request_id=<code>{wave2RequestIdFilter}</code> (최대 {REQUEST_SEARCH_WAVE2_AUDIT_LIMIT}건)
            </p>
          ) : null}
          {wave2AuditLogs.message ? (
            <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Wave 2 audit를 불러오지 못했습니다. ({wave2AuditLogs.message})
            </p>
          ) : null}
          <OpsTable>
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">created_at</th>
                <th className="px-3 py-2">action</th>
                <th className="px-3 py-2">request_id</th>
                <th className="px-3 py-2">actor(user_id)</th>
                <th className="px-3 py-2">target_id</th>
                <th className="px-3 py-2">meta 요약</th>
                <th className="px-3 py-2">details</th>
              </tr>
            </thead>
            <tbody>
              {(wave2AuditLogs.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 text-xs">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2 text-xs">{row.action}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.request_id ? (
                      <div className="flex items-center gap-2">
                        <code className="select-text">{row.request_id}</code>
                        <RequestIdCopyButton requestId={row.request_id} />
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.actor_user_id ?? "system"}</td>
                  <td className="px-3 py-2 text-xs">{row.target_id ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{summarizeMeta(row.meta)}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.request_id ? (
                      <Link
                        href={`/dashboard/ops/system-jobs?q=${encodeURIComponent(row.request_id)}#wave2-audit`}
                        className="text-sky-700 underline underline-offset-2"
                      >
                        Open details
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {(wave2AuditLogs.data?.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-xs text-slate-500" colSpan={7}>조건에 맞는 기록이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </OpsTable>
        </OpsDetailPanel>
      </section>


      <section id={SECTION_IDS.quickCreateAudit}>
        <OpsDetailPanel title={`Dashboard quick create audit (${isQuickCreateRequestSearch ? "request_id 검색 최대 10건" : "최근 50건"})`}>
        <form action="/dashboard/ops/system-jobs" className="mb-3 flex flex-wrap items-end gap-2">
          <select name="quickCreateAction" defaultValue={quickCreateActionFilter} className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
            <option value="all">액션 전체</option>
            <option value="success">success</option>
            <option value="failed">failed</option>
          </select>
          <select name="quickCreateWindow" defaultValue={quickCreateWindow} className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
            <option value="24h">최근 24시간</option>
            <option value="7d">최근 7일</option>
          </select>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            request_id (quickCreateRequestId / q)
            <input
              name="quickCreateRequestId"
              defaultValue={quickCreateRequestIdFilter}
              placeholder="예: req_123... 또는 %req_123%"
              className="w-72 rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold">적용</button>
        </form>
        {isQuickCreateRequestSearch ? (
          <p className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            검색 모드: request_id=<code>{quickCreateRequestIdFilter}</code> (최대 {REQUEST_SEARCH_QUICK_CREATE_LIMIT}건)
          </p>
        ) : null}
        {quickCreateAuditLogs.message ? (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Quick create audit를 불러오지 못했습니다. ({quickCreateAuditLogs.message})
          </p>
        ) : null}
        <OpsTable>
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">created_at</th>
              <th className="px-3 py-2">action</th>
              <th className="px-3 py-2">request_id</th>
              <th className="px-3 py-2">actor_user_id</th>
              <th className="px-3 py-2">board_id</th>
              <th className="px-3 py-2">error_code</th>
              <th className="px-3 py-2">meta 요약</th>
            </tr>
          </thead>
          <tbody>
            {(quickCreateAuditLogs.data ?? []).map((row) => {
              const meta = row.meta && typeof row.meta === "object" ? (row.meta as Record<string, unknown>) : null;
              const boardId = typeof meta?.board_id === "string" ? meta.board_id : row.target_id;
              const errorCode = typeof meta?.error_code === "string" ? meta.error_code : "—";
              const isFailedAction = row.action === AUDIT_ACTIONS.dashboardQuickCreateFailed;

              return (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 text-xs">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2 text-xs">{row.action}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.request_id ? (
                      <div className="flex items-center gap-2">
                        <code className="select-text">{row.request_id}</code>
                        <RequestIdCopyButton requestId={row.request_id} />
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.actor_user_id ?? "system"}</td>
                  <td className="px-3 py-2 text-xs">{boardId ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{isFailedAction ? errorCode : "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{summarizeMeta(row.meta)}</td>
                </tr>
              );
            })}
            {(quickCreateAuditLogs.data?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-3 py-3 text-xs text-slate-500" colSpan={7}>조건에 맞는 기록이 없습니다.</td>
              </tr>
            ) : null}
          </tbody>
        </OpsTable>
        </OpsDetailPanel>
      </section>

    </main>
  );
}
