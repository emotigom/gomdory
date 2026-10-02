"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/requireUser";
import {
  deleteCard,
  setCardFeatured,
  setCardHidden,
  setCardPinned,
  updateCardColorToken,
} from "@/lib/data/cards";
import { logAudit } from "@/lib/data/audit";
import { isCardColorToken } from "@/lib/types/cards";

function getRequiredId(value: FormDataEntryValue | null, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} 값이 올바르지 않습니다.`);
  }

  return value.trim();
}

async function revalidateCardPaths(boardId: string, wallId: string) {
  revalidatePath(`/dashboard/boards/${boardId}/walls/${wallId}`);
  revalidatePath(`/dashboard/boards/${boardId}/class`);
}

export async function setCardHiddenAction(formData: FormData): Promise<void> {
  const boardId = getRequiredId(formData.get("boardId"), "boardId");
  const wallId = getRequiredId(formData.get("wallId"), "wallId");
  const cardId = getRequiredId(formData.get("cardId"), "cardId");
  const hiddenValue = getRequiredId(formData.get("hidden"), "hidden");
  const hidden = hiddenValue === "true";

  const { user } = await requireUser(`/dashboard/boards/${boardId}/walls/${wallId}`);

  await setCardHidden({ cardId, ownerId: user.id, hidden });
  await revalidateCardPaths(boardId, wallId);
}

export async function setCardPinnedAction(formData: FormData): Promise<void> {
  const boardId = getRequiredId(formData.get("boardId"), "boardId");
  const wallId = getRequiredId(formData.get("wallId"), "wallId");
  const cardId = getRequiredId(formData.get("cardId"), "cardId");
  const pinnedValue = getRequiredId(formData.get("pinned"), "pinned");
  const pinned = pinnedValue === "true";

  const { user } = await requireUser(`/dashboard/boards/${boardId}/walls/${wallId}`);

  await setCardPinned({ cardId, ownerId: user.id, pinned });
  await revalidateCardPaths(boardId, wallId);
}

export async function setCardFeaturedAction(formData: FormData): Promise<void> {
  const boardId = getRequiredId(formData.get("boardId"), "boardId");
  const wallId = getRequiredId(formData.get("wallId"), "wallId");
  const cardId = getRequiredId(formData.get("cardId"), "cardId");
  const featuredValue = getRequiredId(formData.get("featured"), "featured");
  const featured = featuredValue === "true";

  const { user } = await requireUser(`/dashboard/boards/${boardId}/walls/${wallId}`);

  await setCardFeatured({ cardId, ownerId: user.id, featured });
  await revalidateCardPaths(boardId, wallId);
}

export async function setCardColorTokenAction(formData: FormData): Promise<void> {
  const boardId = getRequiredId(formData.get("boardId"), "boardId");
  const wallId = getRequiredId(formData.get("wallId"), "wallId");
  const cardId = getRequiredId(formData.get("cardId"), "cardId");
  const tokenValue = getRequiredId(formData.get("token"), "token");

  if (!isCardColorToken(tokenValue)) {
    throw new Error("지원하지 않는 색상 토큰입니다.");
  }

  const { user } = await requireUser(`/dashboard/boards/${boardId}/walls/${wallId}`);

  await updateCardColorToken({ cardId, ownerId: user.id, token: tokenValue });
  await revalidateCardPaths(boardId, wallId);
}

export async function deleteCardAction(formData: FormData): Promise<void> {
  const boardId = getRequiredId(formData.get("boardId"), "boardId");
  const wallId = getRequiredId(formData.get("wallId"), "wallId");
  const cardId = getRequiredId(formData.get("cardId"), "cardId");

  await requireUser(`/dashboard/boards/${boardId}/walls/${wallId}`);
  await deleteCard(cardId);
  await revalidateCardPaths(boardId, wallId);
  await logAudit({
    boardId,
    action: "card.soft_delete",
    targetType: "card",
    targetId: cardId,
    meta: { cardId, wallId },
  });
}
