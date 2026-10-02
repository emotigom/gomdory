import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { DEFAULT_HUD, DEFAULT_LOCKS, DEFAULT_REPLY_TEMPLATES } from "@/lib/controls/boardControlsDefaults";
import { getBoardControls } from "@/lib/data/boardControls";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BoardControlHud, BoardControlLocks, BoardReplyTemplate } from "@/lib/types/boardControls";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ANNOUNCEMENT_LIMIT = 120;
const TEMPLATE_LABEL_LIMIT = 24;
const TEMPLATE_TEXT_LIMIT = 120;
const TEMPLATE_LIMIT = 8;
const PIN_LIMIT = 50;
const HIDDEN_LIMIT = 200;
const RESOLVED_LIMIT = 200;
const RATE_LIMIT_MS = 2000;

type PatchPayload = {
  announcement?: string | null;
  locks?: Partial<BoardControlLocks>;
  hud?: Partial<BoardControlHud>;
  reply_templates?: BoardReplyTemplate[] | null;
  pinned_question_ids?: string[] | null;
  hidden_action_ids?: string[] | null;
  resolved_help_ids?: string[] | null;
};

type ControlsDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  getBoardControlsFn?: typeof getBoardControls;
  logAuditFn?: typeof logAudit;
  nowFn?: () => number;
};

function apiError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function ensureBoardAccess(
  boardId: string,
  deps?: ControlsDeps,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  try {
    const requireUserApiFn = deps?.requireUserApiFn ?? requireUserApi;
    await requireUserApiFn();
  } catch {
    return { ok: false, response: apiError("unauthorized", "인증이 필요합니다.", 401) };
  }

  const supabase = (deps?.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return { ok: false, response: apiError("forbidden", "보드에 접근할 권한이 없습니다.", 403) };
  }

  return { ok: true };
}

function normalizeAnnouncement(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, ANNOUNCEMENT_LIMIT);
}

function normalizeIdArray(value: unknown, limit: number): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) return undefined;
  const filtered = value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const unique = Array.from(new Set(filtered));
  return unique.slice(0, limit);
}

function normalizeLocks(value: unknown): Partial<BoardControlLocks> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const normalized: Partial<BoardControlLocks> = {};
  if (typeof record.question === "boolean") normalized.question = record.question;
  if (typeof record.help === "boolean") normalized.help = record.help;
  if (typeof record.pulse === "boolean") normalized.pulse = record.pulse;
  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeHud(value: unknown): Partial<BoardControlHud> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const normalized: Partial<BoardControlHud> = {};
  if (typeof record.showRoster === "boolean") normalized.showRoster = record.showRoster;
  if (typeof record.showPulse === "boolean") normalized.showPulse = record.showPulse;
  if (typeof record.showPinned === "boolean") normalized.showPinned = record.showPinned;
  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeReplyTemplates(value: unknown): BoardReplyTemplate[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id.trim().slice(0, 40) : "";
      const label = typeof record.label === "string" ? record.label.trim().slice(0, TEMPLATE_LABEL_LIMIT) : "";
      const text = typeof record.text === "string" ? record.text.trim().slice(0, TEMPLATE_TEXT_LIMIT) : "";
      if (!id || !label || !text) return null;
      return { id, label, text };
    })
    .filter((entry): entry is BoardReplyTemplate => Boolean(entry));
  return normalized.slice(0, TEMPLATE_LIMIT);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  deps?: ControlsDeps,
) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return apiError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId, deps);
  if (!access.ok) return access.response;

  try {
    const controls = await (deps?.getBoardControlsFn ?? getBoardControls)(boardId, {
      createIfMissing: true,
    });
    return NextResponse.json({ ok: true, controls });
  } catch (error) {
    const message = error instanceof Error ? error.message : "컨트롤 정보를 불러오지 못했습니다.";
    return apiError("read_failed", message, 502);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  deps?: ControlsDeps,
) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return apiError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId, deps);
  if (!access.ok) return access.response;

  const payload = (await request.json().catch(() => null)) as PatchPayload | null;
  if (!payload || typeof payload !== "object") {
    return apiError("invalid_payload", "설정 값을 확인해주세요.");
  }

  const announcement = normalizeAnnouncement(payload.announcement);
  const locksPatch = normalizeLocks(payload.locks);
  const hudPatch = normalizeHud(payload.hud);
  const replyTemplates = normalizeReplyTemplates(payload.reply_templates);
  const pinnedQuestionIds = normalizeIdArray(payload.pinned_question_ids, PIN_LIMIT);
  const hiddenActionIds = normalizeIdArray(payload.hidden_action_ids, HIDDEN_LIMIT);
  const resolvedHelpIds = normalizeIdArray(payload.resolved_help_ids, RESOLVED_LIMIT);

  if (
    announcement === undefined &&
    locksPatch === undefined &&
    hudPatch === undefined &&
    replyTemplates === undefined &&
    pinnedQuestionIds === undefined &&
    hiddenActionIds === undefined &&
    resolvedHelpIds === undefined
  ) {
    return apiError("invalid_payload", "업데이트할 값이 없습니다.");
  }

  const supabase = (deps?.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const { data: existing, error: existingError } = await supabase
    .from("board_controls")
    .select("updated_at, version, locks, hud, reply_templates")
    .eq("board_id", boardId)
    .maybeSingle();

  if (existingError) {
    return apiError("read_failed", existingError.message, 502);
  }

  const lastUpdatedAt = existing?.updated_at ? new Date(existing.updated_at).getTime() : null;
  const now = deps?.nowFn ? deps.nowFn() : Date.now();
  if (lastUpdatedAt && now >= lastUpdatedAt && now - lastUpdatedAt < RATE_LIMIT_MS) {
    return apiError("rate_limited", "잠시 후 다시 시도해주세요.", 429);
  }

  const nextVersion = (existing?.version ?? 0) + 1;
  const currentLocks =
    existing?.locks && typeof existing.locks === "object" ? (existing.locks as BoardControlLocks) : DEFAULT_LOCKS;
  const currentHud =
    existing?.hud && typeof existing.hud === "object" ? (existing.hud as BoardControlHud) : DEFAULT_HUD;
  const currentTemplates = Array.isArray(existing?.reply_templates)
    ? (existing.reply_templates as BoardReplyTemplate[])
    : DEFAULT_REPLY_TEMPLATES;
  const mergedLocks = { ...currentLocks, ...(locksPatch ?? {}) };
  const mergedHud = { ...currentHud, ...(hudPatch ?? {}) };
  const mergedTemplates = replyTemplates !== undefined ? replyTemplates : currentTemplates;
  const requireUserApiFn = deps?.requireUserApiFn ?? requireUserApi;
  const { user } = await requireUserApiFn();
  const updatePayload = {
    board_id: boardId,
    updated_at: new Date(now).toISOString(),
    updated_by_user_id: user.id,
    version: nextVersion,
    ...(announcement !== undefined ? { announcement } : null),
    ...(locksPatch !== undefined ? { locks: mergedLocks } : null),
    ...(hudPatch !== undefined ? { hud: mergedHud } : null),
    ...(replyTemplates !== undefined ? { reply_templates: mergedTemplates } : null),
    ...(pinnedQuestionIds !== undefined ? { pinned_question_ids: pinnedQuestionIds ?? [] } : null),
    ...(hiddenActionIds !== undefined ? { hidden_action_ids: hiddenActionIds ?? [] } : null),
    ...(resolvedHelpIds !== undefined ? { resolved_help_ids: resolvedHelpIds ?? [] } : null),
  };

  const { error } = await supabase
    .from("board_controls")
    .upsert(updatePayload, { onConflict: "board_id" });

  if (error) {
    return apiError("update_failed", error.message, 502);
  }

  const controls = await (deps?.getBoardControlsFn ?? getBoardControls)(boardId);
  void (deps?.logAuditFn ?? logAudit)({
    boardId,
    action: "board_controls.updated",
    targetType: "board_controls",
      targetId: boardId,
      meta: {
        announcementUpdated: announcement !== undefined,
        locksUpdated: locksPatch !== undefined,
        hudUpdated: hudPatch !== undefined,
        replyTemplatesUpdated: replyTemplates !== undefined,
        pinnedCount: pinnedQuestionIds?.length,
        hiddenCount: hiddenActionIds?.length,
        resolvedCount: resolvedHelpIds?.length,
      },
    });
  return NextResponse.json({ ok: true, controls });
}
