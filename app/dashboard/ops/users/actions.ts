"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { getRequestContext, logAudit, type AuditRequestContext } from "@/lib/data/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  wouldClear?: {
    hasTeacherUiPrefs: boolean;
    presetCount: number;
  };
  requiresConfirmation?: boolean;
  confirmToken?: string;
  executed?: boolean;
};

type Deps = {
  requestHeaders?: Headers;
  requireUserFn?: typeof requireUser;
  isOpsAdminFn?: typeof isOpsAdmin;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  getRequestContextFn?: (headersInput: Headers) => AuditRequestContext;
  logAuditFn?: typeof logAudit;
};

type RunsTableRow = {
  id: string;
  would_payload?: {
    targetUserId?: string;
    hasTeacherUiPrefs?: boolean;
    presetCount?: number;
  } | null;
  status: string;
  created_at: string;
  note?: string | null;
};


const PRESET_KEY = "teacherUiCustomPresetsV2";
const TEACHER_PREFS_KEY = "teacherUiPrefs";
const CONFIRM_WINDOW_MS = 10 * 60 * 1000;

function buildFallbackRequestId() {
  return `ops-ui-reset-${Date.now().toString(36)}`;
}

function createErrorState(message: string, requestId: string) {
  return {
    ok: false,
    message,
    requestId,
  } satisfies ActionState;
}

export async function executeOpsResetUiPrefs(input: { userId: string }, deps?: Deps): Promise<ActionState> {
  const requestHeaders = deps?.requestHeaders ?? (await headers());
  const getCtx = deps?.getRequestContextFn ?? getRequestContext;
  const ctx = getCtx(requestHeaders);
  const requestId = ctx.requestId ?? buildFallbackRequestId();

  try {
    const requireUserFn = deps?.requireUserFn ?? requireUser;
    const isOpsAdminFn = deps?.isOpsAdminFn ?? isOpsAdmin;
    const adminFactory = deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
    const auditFn = deps?.logAuditFn ?? logAudit;

    const { user } = await requireUserFn("/dashboard/ops");
    if (!isOpsAdminFn(user.email)) {
      return createErrorState("운영자 권한이 필요합니다.", requestId);
    }

    const targetUserId = input.userId.trim();
    if (!targetUserId) {
      return createErrorState("리셋할 사용자 ID가 비어 있습니다.", requestId);
    }

    const admin = adminFactory();
    const uiPrefsTable = admin.from("user_ui_prefs" as never) as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: <T>() => Promise<{ data: T | null; error: { message: string } | null }>;
        };
      };
      upsert: (values: { user_id: string; class_prefs: Record<string, unknown> }) => Promise<{ error: { message: string } | null }>;
    };

    const { data: row, error: loadError } = await uiPrefsTable
      .select("class_prefs")
      .eq("user_id", targetUserId)
      .maybeSingle<{ class_prefs?: Record<string, unknown> | null }>();

    if (loadError) {
      return createErrorState(`UI 설정을 조회하지 못했습니다: ${loadError.message}`, requestId);
    }

    const currentClassPrefs = row?.class_prefs ?? {};
    const nextClassPrefs = { ...currentClassPrefs };
    delete nextClassPrefs[TEACHER_PREFS_KEY];
    delete nextClassPrefs[PRESET_KEY];

    const previousPresetCount = Array.isArray(currentClassPrefs[PRESET_KEY])
      ? currentClassPrefs[PRESET_KEY].length
      : 0;

    const { error: saveError } = await uiPrefsTable.upsert({
      user_id: targetUserId,
      class_prefs: nextClassPrefs,
    });

    if (saveError) {
      return createErrorState(`UI 설정 리셋에 실패했습니다: ${saveError.message}`, requestId);
    }

    await auditFn({
      action: "ui_prefs_reset_by_ops",
      targetType: "user_ui_prefs",
      targetId: targetUserId,
      ctx,
      meta: {
        actorUserId: user.id,
        removedKeys: [TEACHER_PREFS_KEY, PRESET_KEY],
        previousPresetCount,
      },
    });

    try {
      revalidatePath("/dashboard/ops/users");
    } catch {
      // no-op in non-Next runtime (tests)
    }

    return {
      ok: true,
      message: "UI 설정을 리셋했습니다.",
      requestId,
    } satisfies ActionState;
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return createErrorState(`UI 설정 리셋 처리 중 오류가 발생했습니다: ${message}`, requestId);
  }
}

export async function previewOpsResetUiPrefs(input: { userId: string }, deps?: Deps): Promise<ActionState> {
  const requestHeaders = deps?.requestHeaders ?? (await headers());
  const getCtx = deps?.getRequestContextFn ?? getRequestContext;
  const ctx = getCtx(requestHeaders);
  const requestId = ctx.requestId ?? buildFallbackRequestId();

  try {
    const requireUserFn = deps?.requireUserFn ?? requireUser;
    const isOpsAdminFn = deps?.isOpsAdminFn ?? isOpsAdmin;
    const adminFactory = deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
    const auditFn = deps?.logAuditFn ?? logAudit;

    const { user } = await requireUserFn("/dashboard/ops");
    if (!isOpsAdminFn(user.email)) {
      return createErrorState("운영자 권한이 필요합니다.", requestId);
    }

    const targetUserId = input.userId.trim();
    if (!targetUserId) {
      return createErrorState("대상 사용자 ID가 비어 있습니다.", requestId);
    }

    const admin = adminFactory();
    const uiPrefsTable = admin.from("user_ui_prefs" as never) as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: <T>() => Promise<{ data: T | null; error: { message: string } | null }>;
        };
      };
    };
    const runsTable = admin.from("ops_user_assistant_runs" as never) as unknown as {
      insert: (values: {
        actor_user_id: string;
        target_user_id: string;
        assistant_type: "ui_prefs_clear";
        would_payload: Record<string, unknown>;
        status: "previewed";
        note: string;
        request_id: string;
      }) => {
        select: (columns: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
      };
    };

    const { data: row, error: loadError } = await uiPrefsTable
      .select("class_prefs")
      .eq("user_id", targetUserId)
      .maybeSingle<{ class_prefs?: Record<string, unknown> | null }>();

    if (loadError) {
      return createErrorState(`UI 설정을 조회하지 못했습니다: ${loadError.message}`, requestId);
    }

    const currentClassPrefs = row?.class_prefs ?? {};
    const presetCount = Array.isArray(currentClassPrefs[PRESET_KEY]) ? currentClassPrefs[PRESET_KEY].length : 0;
    const hasTeacherUiPrefs = TEACHER_PREFS_KEY in currentClassPrefs;
    const wouldCount = Number(hasTeacherUiPrefs) + (presetCount > 0 ? 1 : 0);

    const { data: runRows, error: runError } = await runsTable
      .insert({
        actor_user_id: user.id,
        target_user_id: targetUserId,
        assistant_type: "ui_prefs_clear",
        would_payload: { targetUserId, hasTeacherUiPrefs, presetCount },
        status: "previewed",
        note: "ops_user_ui_prefs_clear_preview",
        request_id: requestId,
      })
      .select("id");

    const runId = Array.isArray(runRows) && runRows[0]?.id ? runRows[0].id : "";
    if (runError || !runId) {
      return createErrorState(`미리보기를 저장하지 못했습니다: ${runError?.message ?? "run_id 생성 실패"}`, requestId);
    }

    await auditFn({
      action: "ops_user_ui_prefs_clear_previewed",
      targetType: "user_ui_prefs",
      targetId: targetUserId,
      ctx,
      meta: {
        actorUserId: user.id,
        runId,
        wouldCount,
        hasTeacherUiPrefs,
        presetCount,
      },
    });

    return {
      ok: true,
      message: "미리보기 완료: 확인 후 실행할 수 있습니다.",
      requestId,
      wouldClear: { hasTeacherUiPrefs, presetCount },
      requiresConfirmation: true,
      confirmToken: runId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return createErrorState(`미리보기 처리 중 오류가 발생했습니다: ${message}`, requestId);
  }
}

export async function executeOpsResetUiPrefsWithConfirm(input: { confirmToken: string }, deps?: Deps): Promise<ActionState> {
  const requestHeaders = deps?.requestHeaders ?? (await headers());
  const getCtx = deps?.getRequestContextFn ?? getRequestContext;
  const ctx = getCtx(requestHeaders);
  const requestId = ctx.requestId ?? buildFallbackRequestId();

  try {
    const requireUserFn = deps?.requireUserFn ?? requireUser;
    const isOpsAdminFn = deps?.isOpsAdminFn ?? isOpsAdmin;
    const adminFactory = deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
    const auditFn = deps?.logAuditFn ?? logAudit;

    const { user } = await requireUserFn("/dashboard/ops");
    if (!isOpsAdminFn(user.email)) {
      return createErrorState("운영자 권한이 필요합니다.", requestId);
    }

    const confirmToken = input.confirmToken.trim();
    if (!confirmToken) {
      return createErrorState("확인 토큰이 없습니다. 미리보기를 다시 실행해 주세요.", requestId);
    }

    const admin = adminFactory();
    const runsTable = admin.from("ops_user_assistant_runs" as never) as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: <T>() => Promise<{ data: T | null; error: { message: string } | null }>;
          update: (values: Record<string, unknown>) => {
            eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            select: (columns: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
    const uiPrefsTable = admin.from("user_ui_prefs" as never) as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: <T>() => Promise<{ data: T | null; error: { message: string } | null }>;
        };
      };
      upsert: (values: { user_id: string; class_prefs: Record<string, unknown> }) => Promise<{ error: { message: string } | null }>;
    };

    const { data: runRowData, error: runError } = await runsTable
      .select("id,would_payload,status,created_at,note")
      .eq("id", confirmToken)
      .maybeSingle<RunsTableRow>();
    if (runError || !runRowData || runRowData.note !== "ops_user_ui_prefs_clear_preview") {
      return createErrorState("확인 토큰이 유효하지 않습니다. 미리보기를 다시 실행해 주세요.", requestId);
    }

    const createdAtMs = Date.parse(runRowData.created_at);
    const expired = Number.isNaN(createdAtMs) || Date.now() - createdAtMs > CONFIRM_WINDOW_MS;
    if (expired) {
      await runsTable.update({ status: "expired", note: "ops_user_ui_prefs_clear_expired" }).eq("id", runRowData.id);
      return createErrorState("확인 토큰이 만료되었습니다. 미리보기를 다시 실행해 주세요.", requestId);
    }

    if (runRowData.status !== "previewed") {
      return createErrorState("이미 실행된 요청입니다. 미리보기를 다시 실행해 주세요.", requestId);
    }

    const targetUserId = String(runRowData.would_payload?.targetUserId ?? "").trim();
    if (!targetUserId) {
      return createErrorState("미리보기 데이터가 손상되었습니다. 미리보기를 다시 실행해 주세요.", requestId);
    }

    const { data: row, error: loadError } = await uiPrefsTable
      .select("class_prefs")
      .eq("user_id", targetUserId)
      .maybeSingle<{ class_prefs?: Record<string, unknown> | null }>();
    if (loadError) {
      return createErrorState(`UI 설정을 조회하지 못했습니다: ${loadError.message}`, requestId);
    }

    const currentClassPrefs = row?.class_prefs ?? {};
    const nextClassPrefs = { ...currentClassPrefs };
    delete nextClassPrefs[TEACHER_PREFS_KEY];
    delete nextClassPrefs[PRESET_KEY];

    const previousPresetCount = Array.isArray(currentClassPrefs[PRESET_KEY]) ? currentClassPrefs[PRESET_KEY].length : 0;
    const { error: saveError } = await uiPrefsTable.upsert({
      user_id: targetUserId,
      class_prefs: nextClassPrefs,
    });
    if (saveError) {
      return createErrorState(`UI 설정 리셋에 실패했습니다: ${saveError.message}`, requestId);
    }

    const { data: finalizeRows } = await runsTable
      .update({ status: "executed", executed_at: new Date().toISOString(), note: "ops_user_ui_prefs_clear_executed" })
      .eq("id", runRowData.id)
      .eq("status", "previewed")
      .select("id");
    if (!Array.isArray(finalizeRows) || finalizeRows.length === 0) {
      return createErrorState("이미 실행된 요청입니다. 미리보기를 다시 실행해 주세요.", requestId);
    }

    await auditFn({
      action: "ops_user_ui_prefs_clear_executed",
      targetType: "user_ui_prefs",
      targetId: targetUserId,
      ctx,
      meta: {
        actorUserId: user.id,
        runId: runRowData.id,
        removedKeys: [TEACHER_PREFS_KEY, PRESET_KEY],
        previousPresetCount,
      },
    });

    try {
      revalidatePath("/dashboard/ops/users");
    } catch {
      // no-op in tests
    }

    return {
      ok: true,
      message: "실행 완료: UI 설정(teacherUiPrefs + presets)을 정리했습니다.",
      requestId,
      executed: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return createErrorState(`실행 처리 중 오류가 발생했습니다: ${message}`, requestId);
  }
}

export async function resetUserUiPrefsByOpsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const userId = String(formData.get("userId") ?? "");
  return executeOpsResetUiPrefs({ userId });
}

export async function previewResetUserUiPrefsByOpsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const userId = String(formData.get("userId") ?? "");
  return previewOpsResetUiPrefs({ userId });
}

export async function executeResetUserUiPrefsByOpsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const confirmToken = String(formData.get("confirmToken") ?? "");
  return executeOpsResetUiPrefsWithConfirm({ confirmToken });
}
