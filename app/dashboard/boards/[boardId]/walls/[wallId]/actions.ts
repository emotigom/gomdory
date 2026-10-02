"use server";

import { revalidatePath } from "next/cache";

import { createCard, deleteCard } from "@/lib/data/cards";
import { canSoftDelete, getBoardPolicy } from "@/lib/data/boardPolicies";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateCardState = {
  error?: string;
  success: boolean;
};

export type DeleteCardState = {
  error?: string;
  success: boolean;
};

const MAX_CARD_LENGTH = 2000;

export async function createCardAction(
  _prevState: CreateCardState,
  formData: FormData,
): Promise<CreateCardState> {
  const boardId = formData.get("boardId");
  const wallId = formData.get("wallId");
  const text = formData.get("text");

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    return { error: "유효한 보드가 필요합니다.", success: false };
  }

  if (typeof wallId !== "string" || wallId.trim().length === 0) {
    return { error: "유효한 담벼락이 필요합니다.", success: false };
  }

  if (typeof text !== "string") {
    return { error: "카드 내용을 입력해주세요.", success: false };
  }

  const normalizedBoardId = boardId.trim();
  const normalizedWallId = wallId.trim();

  const trimmedText = text.trim();

  if (trimmedText.length === 0) {
    return { error: "카드 내용을 비워둘 수 없습니다.", success: false };
  }

  if (trimmedText.length > MAX_CARD_LENGTH) {
    return { error: "카드 내용은 2000자 이하로 작성해주세요.", success: false };
  }

  try {
    await createCard({ wallId: normalizedWallId, text: trimmedText, boardId: normalizedBoardId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "카드를 생성하지 못했습니다.";

    return { error: message, success: false };
  }

  revalidatePath(`/dashboard/boards/${normalizedBoardId}/walls/${normalizedWallId}`);

  return { success: true };
}

export async function deleteCardAction(
  _prevState: DeleteCardState,
  formData: FormData,
): Promise<DeleteCardState> {
  const boardId = formData.get("boardId");
  const wallId = formData.get("wallId");
  const cardId = formData.get("cardId");

  if (typeof boardId !== "string" || boardId.trim().length === 0) {
    return { error: "보드 정보를 확인해주세요.", success: false };
  }

  if (typeof wallId !== "string" || wallId.trim().length === 0) {
    return { error: "담벼락 정보를 확인해주세요.", success: false };
  }

  if (typeof cardId !== "string" || cardId.trim().length === 0) {
    return { error: "삭제할 카드가 올바르지 않습니다.", success: false };
  }

  const normalizedBoardId = boardId.trim();
  const normalizedWallId = wallId.trim();
  const normalizedCardId = cardId.trim();

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: normalizedBoardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return { error: "카드를 삭제할 권한이 없습니다.", success: false };
  }

  const policy = await getBoardPolicy(normalizedBoardId, supabase);

  if (!canSoftDelete(boardRole, policy)) {
    return { error: "보드 정책으로 삭제가 차단되었습니다.", success: false };
  }

  try {
    await deleteCard(normalizedCardId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "카드를 삭제하지 못했습니다.";

    return { error: message, success: false };
  }

  revalidatePath(`/dashboard/boards/${normalizedBoardId}/walls/${normalizedWallId}`);

  return { success: true };
}
