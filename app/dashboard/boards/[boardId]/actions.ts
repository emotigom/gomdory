"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/requireUser";
import {
  getBoard,
  updateBoardToolsEnabled,
  updateBoardUiMinimapMode,
  updateBoardViewType,
} from "@/lib/data/boards.server";
import { getTeacherDefaults } from "@/lib/data/profile";
import {
  createWall,
  deleteWall,
  updateWall,
  updateWallWidth,
  updateWallsPositionOrder,
} from "@/lib/data/walls";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeToolsEnabled } from "@/lib/tools/toolsEnabled";
import { boardHubHref } from "@/lib/dashboard/boardHrefs";
import { resolveLastOpenedBoardIdFromPrefs } from "@/lib/dashboard/lastOpenedBoard";
import { restoreTrashItem } from "@/app/dashboard/ops/trash/actions";

export type CreateWallState = {
  error?: string;
  success: boolean;
};

export type UpdateBoardToolsState = {
  success: boolean;
  error?: string;
};

export type UpdateBoardMinimapState = {
  success: boolean;
  error?: string;
};

export type UpdateWallState = {
  success: boolean;
  error?: string;
};

export type UpdateWallWidthState = {
  success: boolean;
  error?: string;
};

export type ReorderWallsState = {
  success: boolean;
  error?: string;
};

export async function createWallFromDrawerAction(formData: FormData): Promise<void> {
  const boardId = formData.get("boardId");
  const title = formData.get("title");
  const description = formData.get("description");

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    throw new Error("유효하지 않은 보드입니다.");
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("제목을 입력해주세요.");
  }

  const normalizedBoardId = boardId.trim();
  const { user } = await requireUser(`/dashboard/boards/${normalizedBoardId}`);
  const teacherDefaults = await getTeacherDefaults(user.id);

  const normalizedDescription =
    typeof description === "string" && description.trim().length > 0
      ? description.trim()
      : null;

  await createWall({
    boardId: normalizedBoardId,
    title: title.trim(),
    description: normalizedDescription,
    widthPx: teacherDefaults.defaultWallWidthPx,
  });

  revalidatePath(`/dashboard/boards/${boardId}`);
  revalidatePath(`/dashboard/boards/${boardId}/board`);
  revalidatePath(`/dashboard/boards/${boardId}/grid`);
}

export async function createWallAction(
  _prevState: CreateWallState,
  formData: FormData,
): Promise<CreateWallState> {
  const boardId = formData.get("boardId");
  const title = formData.get("title");
  const description = formData.get("description");

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    return { error: "유효하지 않은 보드입니다.", success: false };
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    return { error: "제목을 입력해주세요.", success: false };
  }

  const normalizedBoardId = boardId.trim();
  const { user } = await requireUser(`/dashboard/boards/${normalizedBoardId}`);
  const teacherDefaults = await getTeacherDefaults(user.id);

  const normalizedDescription =
    typeof description === "string" && description.trim().length > 0
      ? description.trim()
      : null;

  try {
    await createWall({
      boardId: normalizedBoardId,
      title: title.trim(),
      description: normalizedDescription,
      widthPx: teacherDefaults.defaultWallWidthPx,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "담벼락을 생성하지 못했습니다.";

    return { error: message, success: false };
  }

  revalidatePath(`/dashboard/boards/${boardId}`);
  revalidatePath(`/dashboard/boards/${boardId}/board`);

  return { success: true };
}

export async function deleteWallAction(formData: FormData): Promise<void> {
  const boardId = formData.get("boardId");
  const wallId = formData.get("wallId");

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    throw new Error("보드 정보를 확인해주세요.");
  }

  if (typeof wallId !== "string" || wallId.trim().length === 0) {
    throw new Error("담벼락 정보를 확인해주세요.");
  }

  const normalizedBoardId = boardId.trim();
  const normalizedWallId = wallId.trim();
  const { user } = await requireUser(`/dashboard/boards/${normalizedBoardId}`);

  await deleteWall({
    boardId: normalizedBoardId,
    wallId: normalizedWallId,
    ownerId: user.id,
  });

  revalidatePath(`/dashboard/boards/${normalizedBoardId}`);
  revalidatePath(`/dashboard/boards/${normalizedBoardId}/board`);
}

export async function updateWallAction(
  _prevState: UpdateWallState,
  formData: FormData,
): Promise<UpdateWallState> {
  const boardId = formData.get("boardId");
  const wallId = formData.get("wallId");
  const title = formData.get("title");
  const description = formData.get("description");
  const uiColorToken = formData.get("uiColorToken");
  const studentWriteEnabled = formData.get("studentWriteEnabled");

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    return { success: false, error: "보드 정보를 확인해주세요." };
  }

  if (typeof wallId !== "string" || wallId.trim().length === 0) {
    return { success: false, error: "섹션 정보를 확인해주세요." };
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    return { success: false, error: "섹션 이름을 입력해주세요." };
  }

  const normalizedBoardId = boardId.trim();
  const normalizedWallId = wallId.trim();
  const normalizedTitle = title.trim();
  const normalizedDescription =
    typeof description === "string" && description.trim().length > 0
      ? description.trim()
      : null;
  const normalizedUiColorToken =
    typeof uiColorToken === "string"
      ? uiColorToken.trim().length > 0
        ? uiColorToken.trim()
        : null
      : undefined;
  const normalizedStudentWriteEnabled =
    typeof studentWriteEnabled === "string"
      ? studentWriteEnabled === "true"
      : undefined;

  const { user } = await requireUser(`/dashboard/boards/${normalizedBoardId}/board`);

  try {
    await updateWall({
      boardId: normalizedBoardId,
      wallId: normalizedWallId,
      ownerId: user.id,
      title: normalizedTitle,
      description: normalizedDescription,
      uiColorToken: normalizedUiColorToken,
      studentWriteEnabled: normalizedStudentWriteEnabled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "섹션을 업데이트하지 못했습니다.";
    return { success: false, error: message };
  }

  revalidatePath(`/dashboard/boards/${normalizedBoardId}/board`);

  return { success: true };
}

export async function updateWallWidthAction(
  _prevState: UpdateWallWidthState,
  formData: FormData,
): Promise<UpdateWallWidthState> {
  const boardId = formData.get("boardId");
  const wallId = formData.get("wallId");
  const widthPx = formData.get("widthPx");

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    return { success: false, error: "보드 정보를 확인해주세요." };
  }

  if (typeof wallId !== "string" || wallId.trim().length === 0) {
    return { success: false, error: "섹션 정보를 확인해주세요." };
  }

  if (typeof widthPx !== "string" || widthPx.trim().length === 0) {
    return { success: false, error: "섹션 너비를 확인해주세요." };
  }

  const normalizedBoardId = boardId.trim();
  const normalizedWallId = wallId.trim();
  const parsedWidthPx = Number(widthPx);

  if (!Number.isFinite(parsedWidthPx)) {
    return { success: false, error: "섹션 너비를 확인해주세요." };
  }

  const { user } = await requireUser(`/dashboard/boards/${normalizedBoardId}/board`);
  const supabase = createSupabaseServerClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id")
    .eq("id", normalizedBoardId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (boardError) {
    return { success: false, error: "보드 정보를 확인해주세요." };
  }

  if (!board) {
    return { success: false, error: "보드 권한을 확인해주세요." };
  }

  try {
    await updateWallWidth({
      boardId: normalizedBoardId,
      wallId: normalizedWallId,
      ownerId: user.id,
      widthPx: parsedWidthPx,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "섹션 너비를 업데이트하지 못했습니다.";
    return { success: false, error: message };
  }

  revalidatePath(`/dashboard/boards/${normalizedBoardId}/board`);

  return { success: true };
}

export async function reorderWallsAction(input: {
  boardId: string;
  wallIdsInOrder: string[] | string;
}): Promise<ReorderWallsState> {
  const boardId = input.boardId;

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    return { success: false, error: "보드 정보를 확인해주세요." };
  }

  const normalizedBoardId = boardId.trim();
  let wallIds: string[] = [];

  if (Array.isArray(input.wallIdsInOrder)) {
    wallIds = input.wallIdsInOrder;
  } else if (typeof input.wallIdsInOrder === "string") {
    try {
      const parsed = JSON.parse(input.wallIdsInOrder);
      if (Array.isArray(parsed)) {
        wallIds = parsed;
      }
    } catch {
      return { success: false, error: "섹션 순서를 확인해주세요." };
    }
  }

  const normalizedWallIds = wallIds
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .map((id) => id.trim());

  if (normalizedWallIds.length === 0) {
    return { success: false, error: "섹션 순서를 확인해주세요." };
  }

  const { user } = await requireUser(`/dashboard/boards/${normalizedBoardId}/board`);

  try {
    await updateWallsPositionOrder(normalizedBoardId, user.id, normalizedWallIds);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "섹션 순서를 업데이트하지 못했습니다.";
    return { success: false, error: message };
  }

  revalidatePath(`/dashboard/boards/${normalizedBoardId}/board`);
  revalidatePath(`/dashboard/boards/${normalizedBoardId}/class`);

  const { board } = await getBoard(normalizedBoardId);
  if (board?.share_code) {
    revalidatePath(`/s/${board.share_code}`);
  }

  return { success: true };
}

export async function updateBoardViewTypeAction(formData: FormData): Promise<void> {
  const boardId = formData.get("boardId");
  const boardViewType = formData.get("boardViewType");

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    throw new Error("보드 정보를 확인해주세요.");
  }

  if (boardViewType !== "grid" && boardViewType !== "wall") {
    throw new Error("보기 타입을 확인해주세요.");
  }

  const normalizedBoardId = boardId.trim();
  const { user } = await requireUser(`/dashboard/boards/${normalizedBoardId}`);

  await updateBoardViewType({
    boardId: normalizedBoardId,
    ownerId: user.id,
    boardViewType,
  });

  revalidatePath(`/dashboard/boards/${normalizedBoardId}`);
  revalidatePath(`/dashboard/boards/${normalizedBoardId}/board`);
  revalidatePath(`/dashboard/boards/${normalizedBoardId}/grid`);
}

export async function updateBoardToolsAction(
  _prev: UpdateBoardToolsState,
  formData: FormData,
): Promise<UpdateBoardToolsState> {
  const boardId = formData.get("boardId");

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    return { success: false, error: "보드 정보를 확인해주세요." };
  }

  const normalizedBoardId = boardId.trim();
  const { user } = await requireUser(`/dashboard/boards/${normalizedBoardId}/board`);
  const toolsEnabled = normalizeToolsEnabled(formData.getAll("toolsEnabled"));

  try {
    await updateBoardToolsEnabled({
      boardId: normalizedBoardId,
      ownerId: user.id,
      toolsEnabled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "보드 도구 설정을 업데이트하지 못했습니다.";
    return { success: false, error: message };
  }

  revalidatePath(`/dashboard/boards/${normalizedBoardId}/board`);

  const { board } = await getBoard(normalizedBoardId);
  if (board?.share_code) {
    revalidatePath(`/s/${board.share_code}`);
  }

  return { success: true };
}

export async function updateBoardMinimapModeAction(
  _prev: UpdateBoardMinimapState,
  formData: FormData,
): Promise<UpdateBoardMinimapState> {
  const boardId = formData.get("boardId");
  const mode = formData.get("mode");

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    return { success: false, error: "보드 정보를 확인해주세요." };
  }

  const normalizedBoardId = boardId.trim();
  const { user } = await requireUser(`/dashboard/boards/${normalizedBoardId}/board`);

  if (mode !== "hover" && mode !== "toggle" && mode !== "always" && mode !== "hidden") {
    return { success: false, error: "미니맵 모드를 확인해주세요." };
  }

  try {
    await updateBoardUiMinimapMode({
      boardId: normalizedBoardId,
      ownerId: user.id,
      mode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "보드 미니맵 모드를 업데이트하지 못했습니다.";
    return { success: false, error: message };
  }

  revalidatePath(`/dashboard/boards/${normalizedBoardId}/board`);

  const { board } = await getBoard(normalizedBoardId);
  if (board?.share_code) {
    revalidatePath(`/s/${board.share_code}`);
  }

  return { success: true };
}


const USER_ID_COLUMN = "user_id";
const CLASS_PREFS_COLUMN = "class_prefs";

export async function clearLastOpenedBoardIdIfMatches(boardId: string): Promise<void> {
  const { user } = await requireUser(boardHubHref(boardId));
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("user_ui_prefs")
    .select(CLASS_PREFS_COLUMN)
    .eq(USER_ID_COLUMN, user.id)
    .maybeSingle();

  if (error) return;

  const classPrefs = (data?.[CLASS_PREFS_COLUMN] ?? {}) as Record<string, unknown>;
  const lastOpenedBoardId = resolveLastOpenedBoardIdFromPrefs(classPrefs);

  if (lastOpenedBoardId !== boardId) return;

  const nextClassPrefs = { ...classPrefs };
  delete nextClassPrefs.lastOpenedBoardId;

  await supabase
    .from("user_ui_prefs")
    .upsert({ [USER_ID_COLUMN]: user.id, [CLASS_PREFS_COLUMN]: { ...nextClassPrefs, lastOpenedBoardId: null } });
}

export async function restoreDeletedBoardAction(boardId: string): Promise<{ ok: boolean; error?: string }> {
  return restoreTrashItem({ tab: "boards", id: boardId });
}
