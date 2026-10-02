"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { resolveMinimapMode, type UiMinimapMode } from "@/lib/data/boards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeToolsEnabled } from "@/lib/tools/toolsEnabled";
import { recordOpsEvent } from "@/lib/ops/recordEvent";

const MIN_WALL_WIDTH = 360;
const MAX_WALL_WIDTH = 960;

export type OpsFormState = {
  success: boolean;
  error?: string;
  message?: string;
};

const normalizeWallWidth = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return MIN_WALL_WIDTH;
  return Math.min(MAX_WALL_WIDTH, Math.max(MIN_WALL_WIDTH, Math.round(numeric)));
};

const MINIMAP_MODES: UiMinimapMode[] = ["hover", "toggle", "always", "hidden"];

type UserUiPrefsRow = {
  user_id?: string;
  default_minimap_mode?: UiMinimapMode | null;
  default_wall_width_px?: number | null;
  default_tools_enabled?: unknown;
};

type UserUiPrefsQuery = {
  select: (columns: string) => UserUiPrefsQuery;
  eq: (column: string, value: string) => UserUiPrefsQuery;
  maybeSingle: () => Promise<{ data: UserUiPrefsRow | null; error: { message: string } | null }>;
};

type UserUiPrefsUpsertQuery = {
  select: (columns: string) => UserUiPrefsUpsertQuery;
  maybeSingle: () => Promise<{ data: UserUiPrefsRow | null; error: { message: string } | null }>;
};

type UserUiPrefsTable = {
  select: (columns: string) => UserUiPrefsQuery;
  upsert: (values: {
    user_id: string;
    default_minimap_mode: UiMinimapMode;
    default_wall_width_px: number;
    default_tools_enabled: string[];
  }) => UserUiPrefsUpsertQuery;
};

type BoardUpdatePayload = {
  ui_minimap_mode: UiMinimapMode;
  ui_minimap_updated_at: string;
  tools_enabled: string[];
  tools_updated_at: string;
};

type BoardUpdateQuery = {
  update: (values: BoardUpdatePayload) => BoardUpdateQuery;
  eq: (column: string, value: string) => BoardUpdateQuery;
  select: (columns: string) => BoardUpdateQuery;
  maybeSingle: () => Promise<{ data: { id: string; share_code: string | null } | null; error: { message: string } | null }>;
};

async function ensureOpsAdmin() {
  const { user } = await requireUser("/dashboard/ops");
  if (!isOpsAdmin(user.email)) {
    throw new Error("ops_only");
  }
  return user;
}

export async function updateOpsDefaultsAction(
  _prev: OpsFormState,
  formData: FormData,
): Promise<OpsFormState> {
  try {
    const user = await ensureOpsAdmin();
    const targetUserId = String(formData.get("userId") ?? "").trim();
    if (!targetUserId) {
      return { success: false, error: "교사 user_id를 입력해주세요." };
    }

    const rawMode = String(formData.get("defaultMinimapMode") ?? "").trim();
    const defaultMinimapMode = MINIMAP_MODES.includes(rawMode as UiMinimapMode)
      ? (rawMode as UiMinimapMode)
      : undefined;
    const defaultWallWidthPx = normalizeWallWidth(formData.get("defaultWallWidthPx"));
    const defaultToolsEnabled = normalizeToolsEnabled(formData.getAll("defaultToolsEnabled"));

    const admin = createSupabaseAdminClient();
    const prefs = admin.from("user_ui_prefs" as never) as unknown as UserUiPrefsTable;
    const { data: rawExisting, error: existingError } = await prefs
      .select("default_minimap_mode, default_wall_width_px, default_tools_enabled")
      .eq("user_id", targetUserId)
      .maybeSingle();
    const existing = rawExisting as {
      default_minimap_mode?: UiMinimapMode | null;
      default_wall_width_px?: number | null;
      default_tools_enabled?: unknown;
    } | null;

    if (existingError) {
      return { success: false, error: "기본값을 불러오지 못했습니다." };
    }

    const mergedDefaults = {
      default_minimap_mode: resolveMinimapMode(
        defaultMinimapMode ?? (existing?.default_minimap_mode as UiMinimapMode | null | undefined),
        "hover",
      ),
      default_wall_width_px: normalizeWallWidth(
        defaultWallWidthPx ?? existing?.default_wall_width_px,
      ),
      default_tools_enabled: normalizeToolsEnabled(
        defaultToolsEnabled ?? existing?.default_tools_enabled ?? [],
      ),
    };

    const { error } = await prefs.upsert({
        user_id: targetUserId,
        default_minimap_mode: mergedDefaults.default_minimap_mode,
        default_wall_width_px: mergedDefaults.default_wall_width_px,
        default_tools_enabled: mergedDefaults.default_tools_enabled,
      }).select("user_id").maybeSingle();

    if (error) {
      return { success: false, error: "기본값을 저장하지 못했습니다." };
    }

    void recordOpsEvent({
      level: "info",
      kind: "auth",
      route: "/dashboard/ops",
      status: 200,
      meta: {
        action: "ops_update_teacher_defaults",
        actorUserId: user.id,
        targetUserId,
      },
    });

    return { success: true, message: "기본값을 저장했습니다." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "기본값을 저장하지 못했습니다.";
    return { success: false, error: message };
  }
}

export async function updateOpsBoardSettingsAction(
  _prev: OpsFormState,
  formData: FormData,
): Promise<OpsFormState> {
  try {
    await ensureOpsAdmin();
    const boardId = String(formData.get("boardId") ?? "").trim();
    if (!boardId) {
      return { success: false, error: "보드 ID를 입력해주세요." };
    }

    const rawMode = String(formData.get("minimapMode") ?? "").trim();
    if (!MINIMAP_MODES.includes(rawMode as UiMinimapMode)) {
      return { success: false, error: "미니맵 모드를 선택해주세요." };
    }
    const mode = rawMode as UiMinimapMode;

    const toolsEnabled = normalizeToolsEnabled(formData.getAll("toolsEnabled"));
    const now = new Date().toISOString();

    const admin = createSupabaseAdminClient();
    const boards = admin.from("boards" as never) as unknown as BoardUpdateQuery;
    const { data, error } = await boards
      .update({
        ui_minimap_mode: mode,
        ui_minimap_updated_at: now,
        tools_enabled: toolsEnabled,
        tools_updated_at: now,
      })
      .eq("id", boardId)
      .select("id, share_code")
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: "보드 설정을 업데이트하지 못했습니다." };
    }

    revalidatePath(`/dashboard/boards/${boardId}`);
    revalidatePath(`/dashboard/boards/${boardId}/board`);
    if (data.share_code) {
      revalidatePath(`/s/${data.share_code}`);
    }

    return { success: true, message: "보드 설정을 업데이트했습니다." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "보드 설정을 업데이트하지 못했습니다.";
    return { success: false, error: message };
  }
}

export async function approveOwnershipRequestAction(requestId: string): Promise<{
  success: boolean;
  error?: string;
  updatedCardCount?: number;
}> {
  try {
    const user = await ensureOpsAdmin();
    const normalizedRequestId = requestId.trim();
    if (!normalizedRequestId) {
      return { success: false, error: "요청 ID가 필요합니다." };
    }

    const admin = createSupabaseAdminClient();
    const { data: ownershipRequest, error: requestError } = await admin
      .from("ownership_requests")
      .select("id, board_id, student_name, new_client_id, status")
      .eq("id", normalizedRequestId)
      .maybeSingle();

    if (requestError || !ownershipRequest) {
      return { success: false, error: "요청을 찾을 수 없습니다." };
    }

    if (ownershipRequest.status !== "pending") {
      return { success: false, error: "이미 처리된 요청입니다." };
    }

    const { data: cards, error: cardsError } = await admin
      .from("cards")
      .select("id, walls!inner(board_id)")
      .eq("walls.board_id", ownershipRequest.board_id)
      .eq("author_type", "student")
      .eq("author_name", ownershipRequest.student_name)
      .or(`author_client_id.is.null,author_client_id.neq.${ownershipRequest.new_client_id}`);

    if (cardsError) {
      return { success: false, error: "카드 목록을 불러오지 못했습니다." };
    }

    const cardRows = (cards ?? []) as Array<{ id: string }>;
    const cardIds = cardRows.map((card) => card.id);
    let updatedCardCount = 0;

    if (cardIds.length > 0) {
      const { data: updatedCards, error: updateError } = await admin
        .from("cards")
        .update({ author_client_id: ownershipRequest.new_client_id })
        .in("id", cardIds)
        .select("id");

      if (updateError) {
        return { success: false, error: "카드 소유권을 업데이트하지 못했습니다." };
      }

      updatedCardCount = updatedCards?.length ?? 0;
    }

    const { error: approveError } = await admin
      .from("ownership_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_user_id: user.id,
        approved_card_count: updatedCardCount,
      })
      .eq("id", ownershipRequest.id);

    if (approveError) {
      return { success: false, error: "요청 상태를 업데이트하지 못했습니다." };
    }

    void recordOpsEvent({
      level: "info",
      kind: "auth",
      route: "/dashboard/ops",
      status: 200,
      meta: {
        action: "ops_ownership_request_approved",
        boardId: ownershipRequest.board_id,
        requestId: ownershipRequest.id,
        updatedCardCount,
      },
    });

    return { success: true, updatedCardCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "요청 승인에 실패했습니다.";
    return { success: false, error: message };
  }
}
