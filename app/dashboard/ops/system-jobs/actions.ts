"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUser } from "@/lib/auth/requireUser";
import { getRequestContext, logAudit, type AuditRequestContext } from "@/lib/data/audit";
import { AUDIT_ACTIONS } from "@/lib/data/auditActions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  redirectTo?: string;
  envList?: readonly string[];
  wouldCount?: number;
  previewItems?: ReportsBacklogPreviewItem[];
  executedCount?: number;
  requiresConfirmation?: boolean;
  confirmToken?: string;
};

type ReportsBacklogPreviewItem = {
  id: string;
  targetType: "post" | "comment";
  targetId: string;
  reason: string;
  createdAt: string;
};



type QueryError = { message: string };

type QueryResponse<T> = {
  data: T;
  error: QueryError | null;
};

interface LooseQuery<TData = unknown> extends PromiseLike<QueryResponse<TData>> {
  select(columns?: string): LooseQuery<TData>;
  eq(column: string, value: unknown): LooseQuery<TData>;
  gte(column: string, value: unknown): LooseQuery<TData>;
  order(column: string, options?: { ascending?: boolean }): LooseQuery<TData>;
  limit(count: number): LooseQuery<TData>;
  insert(values: unknown): LooseQuery<TData>;
  update(values: unknown): LooseQuery<TData>;
  in(column: string, values: readonly string[]): LooseQuery<TData>;
  single(): Promise<QueryResponse<TData>>;
  maybeSingle(): Promise<QueryResponse<TData | null>>;
}

type RpcRunRetentionResult = { blocked?: boolean; reason?: string } | null;

type RunsTableRow = {
  id: string;
  preview_payload?: { reportIds?: unknown } | null;
  status: string;
  created_at: string;
};

interface LooseSupabaseAdminClient {
  rpc(fn: string, params: Record<string, unknown>): Promise<QueryResponse<RpcRunRetentionResult>>;
  from(table: string): LooseQuery;
}
type CommunityReportPreviewRow = {
  id: string;
  target_type: "post" | "comment" | string;
  target_id: string;
  reason: string;
  created_at: string;
};

type Deps = {
  requestHeaders?: Headers;
  requireUserFn?: typeof requireUser;
  isOpsAdminFn?: typeof isOpsAdmin;
  getRequestContextFn?: (headersInput: Headers) => AuditRequestContext;
  logAuditFn?: typeof logAudit;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

const FAIL_MESSAGE = "실행 요청을 처리하지 못했습니다.";

const REQUIRED_SUPABASE_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const REPORTS_BACKLOG_PREVIEW_LIMIT = 50;
const REPORTS_BACKLOG_PREVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;
const REPORTS_BACKLOG_CONFIRM_WINDOW_MS = 10 * 60 * 1000;

function buildFallbackRequestId() {
  return `ops-system-jobs-${Date.now().toString(36)}`;
}

function createState(message: string, requestId: string, ok = false): ActionState {
  return {
    ok,
    message,
    requestId,
  };
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // noop in test/non-request contexts
  }
}

async function resolveActorAndContext(deps?: Deps) {
  const requestHeaders = deps?.requestHeaders ?? (await headers());
  const getCtx = deps?.getRequestContextFn ?? getRequestContext;
  const ctx = getCtx(requestHeaders);
  const requestId = ctx.requestId ?? buildFallbackRequestId();
  const requireUserFn = deps?.requireUserFn ?? requireUser;
  const isOpsAdminFn = deps?.isOpsAdminFn ?? isOpsAdmin;

  const { user } = await requireUserFn("/dashboard/ops/system-jobs");
  if (!isOpsAdminFn(user.email)) {
    return {
      ok: false,
      user,
      ctx,
      requestId,
      errorState: createState("운영자 권한이 필요합니다.", requestId),
    } as const;
  }

  return {
    ok: true,
    user,
    ctx,
    requestId,
  } as const;
}

async function writeAudit(action: string, ctx: AuditRequestContext, meta: Record<string, unknown>, deps?: Deps) {
  const auditFn = deps?.logAuditFn ?? logAudit;
  await auditFn({
    action,
    targetType: "ops_system_jobs_alert",
    targetId: action,
    ctx,
    meta,
  });
}

async function runRetention(dryRun: boolean, deps?: Deps): Promise<ActionState> {
  let requestId = buildFallbackRequestId();

  try {
    const actor = await resolveActorAndContext(deps);
    requestId = actor.requestId;
    if (!actor.ok) {
      return actor.errorState;
    }

    const adminFactory = deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
    const admin = adminFactory() as unknown as LooseSupabaseAdminClient;
    const { data, error } = await admin.rpc("run_ops_data_retention", {
      p_trigger_source: dryRun ? "ops_manual_dry_run" : "ops_manual_run",
      p_dry_run: dryRun,
    });

    if (error) {
      await writeAudit(
        AUDIT_ACTIONS.opsRetentionDryRunRequested,
        actor.ctx,
        { ok: false, dryRun, error: error.message },
        deps,
      );
      return createState(`실행 실패: ${error.message}`, requestId);
    }

    const result = data;
    safeRevalidatePath("/dashboard/ops/system-jobs");

    if (result?.blocked) {
      await writeAudit(
        AUDIT_ACTIONS.opsRetentionDryRunRequested,
        actor.ctx,
        { ok: false, dryRun, blocked: true, reason: result.reason ?? null },
        deps,
      );
      return createState(`실행 차단: ${result.reason ?? "보호 규칙에 의해 중단됨"}`, requestId);
    }

    await writeAudit(AUDIT_ACTIONS.opsRetentionDryRunRequested, actor.ctx, { ok: true, dryRun }, deps);
    return {
      ok: true,
      message: dryRun ? "드라이런 완료: 대상 건수를 갱신했습니다." : "실행 완료: 보존 작업이 수행되었습니다.",
      requestId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : FAIL_MESSAGE;
    return createState(message, requestId);
  }
}

export async function executeOpenReportsQuickAction(deps?: Deps): Promise<ActionState> {
  let requestId = buildFallbackRequestId();

  try {
    const actor = await resolveActorAndContext(deps);
    requestId = actor.requestId;
    if (!actor.ok) {
      return actor.errorState;
    }

    const redirectTo = "/dashboard/ops/reports?status=open";
    await writeAudit("ops_alert_open_reports_navigate", actor.ctx, { ok: true, redirectTo }, deps);

    return {
      ok: true,
      message: "open reports 화면으로 이동합니다.",
      requestId,
      redirectTo,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : FAIL_MESSAGE;
    return createState(`이동 처리 실패: ${message}`, requestId);
  }
}

export async function executeUiPrefsAuditQuickAction(deps?: Deps): Promise<ActionState> {
  let requestId = buildFallbackRequestId();

  try {
    const actor = await resolveActorAndContext(deps);
    requestId = actor.requestId;
    if (!actor.ok) {
      return actor.errorState;
    }

    const redirectTo = "/dashboard/ops/system-jobs?auditAction=ui_prefs_*&auditWindow=24h#ui-prefs-audit";
    await writeAudit("ops_alert_ui_prefs_spike_navigate", actor.ctx, { ok: true, redirectTo }, deps);

    return {
      ok: true,
      message: "UI prefs 감사 로그로 이동합니다.",
      requestId,
      redirectTo,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : FAIL_MESSAGE;
    return createState(`이동 처리 실패: ${message}`, requestId);
  }
}

export async function executeRequiredEnvQuickAction(deps?: Deps): Promise<ActionState> {
  let requestId = buildFallbackRequestId();

  try {
    const actor = await resolveActorAndContext(deps);
    requestId = actor.requestId;
    if (!actor.ok) {
      return actor.errorState;
    }

    await writeAudit(
      "ops_alert_supabase_env_list_opened",
      actor.ctx,
      { ok: true, requiredEnv: REQUIRED_SUPABASE_ENV },
      deps,
    );

    return {
      ok: true,
      message: "필수 env 목록을 확인하세요.",
      requestId,
      envList: REQUIRED_SUPABASE_ENV,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : FAIL_MESSAGE;
    return createState(`목록 조회 실패: ${message}`, requestId);
  }
}

export async function previewReportsBacklogAction(deps?: Deps): Promise<ActionState> {
  let requestId = buildFallbackRequestId();

  try {
    const actor = await resolveActorAndContext(deps);
    requestId = actor.requestId;
    if (!actor.ok) {
      return actor.errorState;
    }

    const adminFactory = deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
    const admin = adminFactory() as unknown as LooseSupabaseAdminClient;
    const since = new Date(Date.now() - REPORTS_BACKLOG_PREVIEW_WINDOW_MS).toISOString();
    const { data, error } = await admin
      .from("community_reports")
      .select("id,target_type,target_id,reason,created_at")
      .eq("status", "open")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(REPORTS_BACKLOG_PREVIEW_LIMIT);

    if (error) {
      await writeAudit(AUDIT_ACTIONS.opsReportsBacklogAssistantPreview, actor.ctx, { ok: false, error: error.message }, deps);
      return createState(`미리보기 실패: ${error.message}`, requestId);
    }

    const previewRows: CommunityReportPreviewRow[] = Array.isArray(data)
      ? data.filter(
          (row): row is CommunityReportPreviewRow =>
            typeof row === "object" &&
            row !== null &&
            "id" in row &&
            "target_type" in row &&
            "target_id" in row &&
            "reason" in row &&
            "created_at" in row,
        )
      : [];

    const previewItems: ReportsBacklogPreviewItem[] = previewRows.map((row) => ({
      id: row.id,
      targetType: row.target_type === "comment" ? "comment" : "post",
      targetId: row.target_id,
      reason: row.reason,
      createdAt: row.created_at,
    }));
    const reportIds = previewItems.map((row) => row.id).filter(Boolean);

    const runInsertQuery = admin
      .from("ops_reports_backlog_runs")
      .insert({
        actor_user_id: actor.user.id,
        would_count: reportIds.length,
        preview_payload: { reportIds },
        status: "previewed",
        note: "preview_requested",
      })
      .select("id");

    const runInsertResult =
      typeof runInsertQuery.single === "function" ? await runInsertQuery.single() : await runInsertQuery;
    const runError = runInsertResult.error;
    const runData = runInsertResult.data;
    const runRow =
      runData && typeof runData === "object" && !Array.isArray(runData)
        ? (runData as { id?: string })
        : Array.isArray(runData) && runData.length > 0 && typeof runData[0] === "object" && runData[0] !== null
          ? (runData[0] as { id?: string })
          : null;

    if (runError || !runRow?.id) {
      await writeAudit(
        AUDIT_ACTIONS.opsReportsBacklogAssistantPreview,
        actor.ctx,
        { ok: false, error: runError?.message ?? "preview_run_insert_failed" },
        deps,
      );
      return createState(`미리보기 실패: ${runError?.message ?? "preview run 저장 실패"}`, requestId);
    }

    await writeAudit(
      AUDIT_ACTIONS.opsReportsBacklogAssistantPreview,
      actor.ctx,
      {
        ok: true,
        dryRun: true,
        policyAction: "bulk_resolve_open_reports",
        windowHours: 24,
        runId: runRow.id,
        wouldCount: reportIds.length,
      },
      deps,
    );

    return {
      ok: true,
      message: reportIds.length
        ? "드라이런 완료: 최근 24시간 open reports 대상을 확인했습니다."
        : "드라이런 완료: 처리할 open reports 대상이 없습니다.",
      requestId,
      wouldCount: reportIds.length,
      previewItems,
      requiresConfirmation: reportIds.length > 0,
      confirmToken: runRow.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : FAIL_MESSAGE;
    return createState(message, requestId);
  }
}

export async function executeReportsBacklogBulkResolveAction(confirmToken: string, deps?: Deps): Promise<ActionState> {
  let requestId = buildFallbackRequestId();

  try {
    const actor = await resolveActorAndContext(deps);
    requestId = actor.requestId;
    if (!actor.ok) {
      return actor.errorState;
    }

    const adminFactory = deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
    const admin = adminFactory() as unknown as LooseSupabaseAdminClient;
    const { data: runRowData, error: runError } = await admin
      .from("ops_reports_backlog_runs")
      .select("id,preview_payload,status,created_at")
      .eq("id", confirmToken)
      .maybeSingle();

    const runRow =
      runRowData && typeof runRowData === "object" ? (runRowData as RunsTableRow) : null;

    if (runError || !runRow) {
      await writeAudit(
        AUDIT_ACTIONS.opsReportsBacklogAssistantExecute,
        actor.ctx,
        { ok: false, blocked: true, reason: "preview_run_missing", runId: confirmToken, error: runError?.message ?? null },
        deps,
      );
      return createState("확인 토큰이 만료되었습니다. 드라이런을 다시 실행해 주세요.", requestId);
    }

    const createdAtMs = Date.parse(runRow.created_at);
    const isExpired = Number.isNaN(createdAtMs) || Date.now() - createdAtMs > REPORTS_BACKLOG_CONFIRM_WINDOW_MS;
    if (isExpired) {
      await admin.from("ops_reports_backlog_runs").update({ status: "expired", note: "execute_blocked_expired" }).eq("id", runRow.id);
      await writeAudit(
        AUDIT_ACTIONS.opsReportsBacklogAssistantExecute,
        actor.ctx,
        { ok: false, blocked: true, reason: "preview_run_expired", runId: runRow.id },
        deps,
      );
      return createState("확인 토큰이 만료되었습니다. 드라이런을 다시 실행해 주세요.", requestId);
    }

    if (runRow.status !== "previewed") {
      await writeAudit(
        AUDIT_ACTIONS.opsReportsBacklogAssistantExecute,
        actor.ctx,
        { ok: false, blocked: true, reason: "preview_run_already_used", runId: runRow.id, status: runRow.status },
        deps,
      );
      return createState("이미 사용된 미리보기입니다. 드라이런을 다시 실행해 주세요.", requestId);
    }

    const payload = (runRow.preview_payload ?? {}) as { reportIds?: unknown };
    const reportIds = Array.isArray(payload.reportIds) ? payload.reportIds.filter((value): value is string => typeof value === "string") : [];

    if (reportIds.length === 0) {
      await admin
        .from("ops_reports_backlog_runs")
        .update({ status: "executed", executed_count: 0, note: "execute_noop_empty_preview" })
        .eq("id", runRow.id)
        .eq("status", "previewed");
      await writeAudit(
        AUDIT_ACTIONS.opsReportsBacklogAssistantExecute,
        actor.ctx,
        { ok: true, runId: runRow.id, executedCount: 0, skipped: true },
        deps,
      );
      return {
        ok: true,
        message: "실행 완료: 처리할 open reports 대상이 없습니다.",
        requestId,
        executedCount: 0,
      };
    }

    const resolvedAt = new Date().toISOString();
    const { error } = await admin
      .from("community_reports")
      .update({ status: "resolved", resolved_at: resolvedAt, resolved_by_user_id: actor.user.id })
      .in("id", reportIds)
      .eq("status", "open");

    if (error) {
      await admin
        .from("ops_reports_backlog_runs")
        .update({ note: `execute_failed:${error.message.slice(0, 180)}` })
        .eq("id", runRow.id)
        .eq("status", "previewed");
      await writeAudit(
        AUDIT_ACTIONS.opsReportsBacklogAssistantExecute,
        actor.ctx,
        { ok: false, runId: runRow.id, policyAction: "bulk_resolve_open_reports", error: error.message, targetCount: reportIds.length },
        deps,
      );
      return createState(`일괄 실행 실패: ${error.message}`, requestId);
    }

    const { data: finalizeRows } = await admin
      .from("ops_reports_backlog_runs")
      .update({ status: "executed", executed_count: reportIds.length, note: "execute_success" })
      .eq("id", runRow.id)
      .eq("status", "previewed")
      .select("id");
    if (!Array.isArray(finalizeRows) || finalizeRows.length === 0) {
      await writeAudit(
        AUDIT_ACTIONS.opsReportsBacklogAssistantExecute,
        actor.ctx,
        { ok: false, blocked: true, reason: "preview_run_already_used", runId: runRow.id },
        deps,
      );
      return createState("이미 사용된 미리보기입니다. 드라이런을 다시 실행해 주세요.", requestId);
    }

    safeRevalidatePath("/dashboard/ops/system-jobs");
    safeRevalidatePath("/dashboard/ops/reports");

    await writeAudit(
      AUDIT_ACTIONS.opsReportsBacklogAssistantExecute,
      actor.ctx,
      { ok: true, runId: runRow.id, policyAction: "bulk_resolve_open_reports", executedCount: reportIds.length },
      deps,
    );

    return {
      ok: true,
      message: `실행 완료: open reports ${reportIds.length}건을 resolved 처리했습니다.`,
      requestId,
      executedCount: reportIds.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : FAIL_MESSAGE;
    return createState(message, requestId);
  }
}

export async function runRetentionAction(prevState: ActionState): Promise<ActionState> {
  void prevState;
  return runRetention(false);
}

export async function runRetentionDryRunAction(prevState: ActionState): Promise<ActionState> {
  void prevState;
  return runRetention(true);
}

export async function openReportsQuickAction(prevState: ActionState): Promise<ActionState> {
  void prevState;
  return executeOpenReportsQuickAction();
}

export async function openUiPrefsAuditQuickAction(prevState: ActionState): Promise<ActionState> {
  void prevState;
  return executeUiPrefsAuditQuickAction();
}

export async function showRequiredEnvListQuickAction(prevState: ActionState): Promise<ActionState> {
  void prevState;
  return executeRequiredEnvQuickAction();
}

export async function previewReportsBacklogQuickAction(prevState: ActionState): Promise<ActionState> {
  void prevState;
  return previewReportsBacklogAction();
}

export async function runReportsBacklogBulkResolveQuickAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  void prevState;
  const confirmToken = String(formData.get("confirmToken") ?? "").trim();
  if (!confirmToken) {
    return createState("확인 토큰이 없습니다. 드라이런을 다시 실행해 주세요.", buildFallbackRequestId());
  }
  return executeReportsBacklogBulkResolveAction(confirmToken);
}
