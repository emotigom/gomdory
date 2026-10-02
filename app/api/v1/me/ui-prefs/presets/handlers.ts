import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { loadUiClassPrefs, saveUiClassPrefs } from "@/lib/data/uiPrefsPresets";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDashboardCustomPagesV2Enabled } from "@/lib/dashboard/featureFlags";
import { getRequestContext, logAudit } from "@/lib/data/audit";
import { AUDIT_ACTIONS } from "@/lib/data/auditActions";
import {
  createTeacherUiPresetV2,
  deleteTeacherUiPresetV2,
  renameTeacherUiPresetV2,
  sanitizeTeacherUiPresetV2List,
} from "@/lib/teacherPrefs/customPresetV2";

type PresetBody = {
  name?: string;
  prefs?: unknown;
  id?: string;
};

export type PresetRouteDeps = {
  requireUserApiFn?: typeof requireUserApi;
  loadUiClassPrefsFn?: typeof loadUiClassPrefs;
  saveUiClassPrefsFn?: typeof saveUiClassPrefs;
  checkRateLimitFn?: typeof checkRateLimit;
  getRateLimitSubjectFn?: typeof getRateLimitSubject;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  recordAuditLogFn?: (input: {
    userId: string;
    action:
      | typeof AUDIT_ACTIONS.uiPrefsPresetCreated
      | typeof AUDIT_ACTIONS.uiPrefsPresetRenamed
      | typeof AUDIT_ACTIONS.uiPrefsPresetDeleted;
    ctx: ReturnType<typeof getRequestContext>;
    targetId: string;
    meta: Record<string, unknown>;
  }) => Promise<void>;
};

const PRESET_KEY = "teacherUiCustomPresetsV2";
const PRESET_WRITE_RATE_LIMIT = {
  windowSeconds: 60,
  limit: 30,
} as const;

function featureOffResponse(requestId: string) {
  return jsonErrorWithRequestId(
    "FEATURE_DISABLED",
    "기능이 비활성화되어 있습니다.",
    requestId,
    404,
    undefined,
    withNoStoreHeaders(),
  );
}

async function resolveUserId(request: Request, deps?: PresetRouteDeps) {
  const requestId = getOrCreateRequestId(request);
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;
  try {
    const { user } = await requireUser();
    return { ok: true as const, requestId, userId: user.id };
  } catch {
    return {
      ok: false as const,
      response: jsonErrorWithRequestId("AUTH_REQUIRED", "인증이 필요합니다.", requestId, 401, undefined, withNoStoreHeaders()),
    };
  }
}

async function loadClassPrefs(userId: string) {
  return loadUiClassPrefs(userId);
}

async function enforceWriteRateLimit(request: Request, userId: string, deps?: PresetRouteDeps) {
  const getSubject = deps?.getRateLimitSubjectFn ?? getRateLimitSubject;
  const rateLimit = deps?.checkRateLimitFn ?? checkRateLimit;
  const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)() as unknown as Parameters<typeof checkRateLimit>[0];
  const subject = await getSubject(request, userId);
  return rateLimit(admin, {
    key: `me:ui-prefs:presets:write:${subject}`,
    windowSeconds: PRESET_WRITE_RATE_LIMIT.windowSeconds,
    limit: PRESET_WRITE_RATE_LIMIT.limit,
  });
}

async function recordPresetAudit(input: {
  userId: string;
  action:
      | typeof AUDIT_ACTIONS.uiPrefsPresetCreated
      | typeof AUDIT_ACTIONS.uiPrefsPresetRenamed
      | typeof AUDIT_ACTIONS.uiPrefsPresetDeleted;
  ctx: ReturnType<typeof getRequestContext>;
  targetId: string;
  meta: Record<string, unknown>;
}) {
  await logAudit({
    action: input.action,
    targetType: "ui_prefs_preset",
    targetId: input.targetId,
    meta: input.meta,
    ctx: input.ctx,
  });
}

export async function handleGetPresets(request: Request) {
  if (!isDashboardCustomPagesV2Enabled()) return featureOffResponse(getOrCreateRequestId(request));

  const auth = await resolveUserId(request);
  if (!auth.ok) return auth.response;

  const loaded = await loadClassPrefs(auth.userId);
  if (!loaded.ok) {
    return jsonErrorWithRequestId("PREFS_LOAD_FAILED", "프리셋을 불러오지 못했습니다.", auth.requestId, 503, undefined, withNoStoreHeaders());
  }

  const presets = sanitizeTeacherUiPresetV2List(loaded.classPrefs[PRESET_KEY]);
  return jsonOkWithRequestId({ presets }, auth.requestId, withNoStoreHeaders());
}

export async function handleCreatePreset(request: Request, deps?: PresetRouteDeps) {
  if (!isDashboardCustomPagesV2Enabled()) return featureOffResponse(getOrCreateRequestId(request));
  const auth = await resolveUserId(request, deps);
  if (!auth.ok) return auth.response;

  try {
    const limitResult = await enforceWriteRateLimit(request, auth.userId, deps);
    if (!limitResult.ok) {
      return jsonErrorWithRequestId(
        "RATE_LIMITED",
        "rate_limited",
        auth.requestId,
        429,
        { retryAfterSeconds: limitResult.retryAfterSeconds },
        withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
      );
    }
  } catch {
    // fail-open for small-team ops stability
  }

  const body = (await request.json().catch(() => null)) as PresetBody | null;
  const ctx = getRequestContext(request);
  const loadClassPrefsFn = deps?.loadUiClassPrefsFn ?? loadClassPrefs;
  const saveClassPrefsFn = deps?.saveUiClassPrefsFn ?? saveUiClassPrefs;
  const auditFn = deps?.recordAuditLogFn ?? ((input) => recordPresetAudit(input));

  const loaded = await loadClassPrefsFn(auth.userId);
  if (!loaded.ok) {
    return jsonErrorWithRequestId("PREFS_LOAD_FAILED", "프리셋을 불러오지 못했습니다.", auth.requestId, 503, undefined, withNoStoreHeaders());
  }

  const current = sanitizeTeacherUiPresetV2List(loaded.classPrefs[PRESET_KEY]);
  const created = createTeacherUiPresetV2(current, { name: body?.name ?? "", prefs: body?.prefs });
  if (!created.ok) {
    return jsonErrorWithRequestId(created.code, created.message, auth.requestId, 400, undefined, withNoStoreHeaders());
  }

  const { error } = await saveClassPrefsFn(auth.userId, {
    ...loaded.classPrefs,
    [PRESET_KEY]: created.presets,
  });

  if (error) {
    return jsonErrorWithRequestId("PREFS_SAVE_FAILED", "프리셋 저장에 실패했습니다.", auth.requestId, 503, undefined, withNoStoreHeaders());
  }

  void auditFn({
    userId: auth.userId,
    action: AUDIT_ACTIONS.uiPrefsPresetCreated,
    ctx,
    targetId: created.presets[0]?.id ?? "unknown",
    meta: { presetName: created.presets[0]?.name ?? null, presetCount: created.presets.length },
  }).catch(() => undefined);

  return jsonOkWithRequestId({ presets: created.presets }, auth.requestId, withNoStoreHeaders());
}

export async function handleRenamePreset(request: Request, deps?: PresetRouteDeps) {
  if (!isDashboardCustomPagesV2Enabled()) return featureOffResponse(getOrCreateRequestId(request));
  const auth = await resolveUserId(request, deps);
  if (!auth.ok) return auth.response;

  try {
    const limitResult = await enforceWriteRateLimit(request, auth.userId, deps);
    if (!limitResult.ok) {
      return jsonErrorWithRequestId(
        "RATE_LIMITED",
        "rate_limited",
        auth.requestId,
        429,
        { retryAfterSeconds: limitResult.retryAfterSeconds },
        withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
      );
    }
  } catch {
    // fail-open for small-team ops stability
  }

  const loadClassPrefsFn = deps?.loadUiClassPrefsFn ?? loadClassPrefs;
  const saveClassPrefsFn = deps?.saveUiClassPrefsFn ?? saveUiClassPrefs;
  const ctx = getRequestContext(request);
  const auditFn = deps?.recordAuditLogFn ?? ((input) => recordPresetAudit(input));
  const body = (await request.json().catch(() => null)) as PresetBody | null;
  const loaded = await loadClassPrefsFn(auth.userId);
  if (!loaded.ok) {
    return jsonErrorWithRequestId("PREFS_LOAD_FAILED", "프리셋을 불러오지 못했습니다.", auth.requestId, 503, undefined, withNoStoreHeaders());
  }

  const current = sanitizeTeacherUiPresetV2List(loaded.classPrefs[PRESET_KEY]);
  const renamed = renameTeacherUiPresetV2(current, { id: body?.id ?? "", name: body?.name ?? "" });
  if (!renamed.ok) {
    return jsonErrorWithRequestId(renamed.code, renamed.message, auth.requestId, 400, undefined, withNoStoreHeaders());
  }

  const { error } = await saveClassPrefsFn(auth.userId, {
    ...loaded.classPrefs,
    [PRESET_KEY]: renamed.presets,
  });

  if (error) {
    return jsonErrorWithRequestId("PREFS_SAVE_FAILED", "프리셋 이름 변경에 실패했습니다.", auth.requestId, 503, undefined, withNoStoreHeaders());
  }

  void auditFn({
    userId: auth.userId,
    action: AUDIT_ACTIONS.uiPrefsPresetRenamed,
    ctx,
    targetId: body?.id ?? "unknown",
    meta: { presetName: body?.name ?? null, presetCount: renamed.presets.length },
  }).catch(() => undefined);

  return jsonOkWithRequestId({ presets: renamed.presets }, auth.requestId, withNoStoreHeaders());
}

export async function handleDeletePreset(request: Request, deps?: PresetRouteDeps) {
  if (!isDashboardCustomPagesV2Enabled()) return featureOffResponse(getOrCreateRequestId(request));
  const auth = await resolveUserId(request, deps);
  if (!auth.ok) return auth.response;

  try {
    const limitResult = await enforceWriteRateLimit(request, auth.userId, deps);
    if (!limitResult.ok) {
      return jsonErrorWithRequestId(
        "RATE_LIMITED",
        "rate_limited",
        auth.requestId,
        429,
        { retryAfterSeconds: limitResult.retryAfterSeconds },
        withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
      );
    }
  } catch {
    // fail-open for small-team ops stability
  }

  const loadClassPrefsFn = deps?.loadUiClassPrefsFn ?? loadClassPrefs;
  const saveClassPrefsFn = deps?.saveUiClassPrefsFn ?? saveUiClassPrefs;
  const ctx = getRequestContext(request);
  const auditFn = deps?.recordAuditLogFn ?? ((input) => recordPresetAudit(input));
  const body = (await request.json().catch(() => null)) as PresetBody | null;

  const loaded = await loadClassPrefsFn(auth.userId);
  if (!loaded.ok) {
    return jsonErrorWithRequestId("PREFS_LOAD_FAILED", "프리셋을 불러오지 못했습니다.", auth.requestId, 503, undefined, withNoStoreHeaders());
  }

  const current = sanitizeTeacherUiPresetV2List(loaded.classPrefs[PRESET_KEY]);
  const deleted = deleteTeacherUiPresetV2(current, body?.id ?? "");
  if (!deleted.ok) {
    return jsonErrorWithRequestId(deleted.code, deleted.message, auth.requestId, 400, undefined, withNoStoreHeaders());
  }

  const { error } = await saveClassPrefsFn(auth.userId, {
    ...loaded.classPrefs,
    [PRESET_KEY]: deleted.presets,
  });

  if (error) {
    return jsonErrorWithRequestId("PREFS_SAVE_FAILED", "프리셋 삭제에 실패했습니다.", auth.requestId, 503, undefined, withNoStoreHeaders());
  }

  void auditFn({
    userId: auth.userId,
    action: AUDIT_ACTIONS.uiPrefsPresetDeleted,
    ctx,
    targetId: body?.id ?? "unknown",
    meta: { presetCount: deleted.presets.length },
  }).catch(() => undefined);

  return jsonOkWithRequestId({ presets: deleted.presets }, auth.requestId, withNoStoreHeaders());
}
