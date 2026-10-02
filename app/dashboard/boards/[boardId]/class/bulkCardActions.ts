import { apiV1Path } from "@/lib/standards/pathTypes";

export type BulkResult = { ok: true; updated: number } | { ok: false; message: string };

export function buildBulkActionSuccessMessage(action: "move" | "delete", updated: number): string {
  if (action === "move") {
    return updated > 0 ? `${updated}개 카드를 이동했어요.` : "이동된 카드가 없습니다.";
  }
  return updated > 0 ? `${updated}개 카드를 휴지통으로 이동했어요.` : "삭제된 카드가 없습니다.";
}

export async function runBulkCardAction(input: {
  boardId: string;
  cardIds: string[];
  action: "move" | "delete";
  payload?: Record<string, unknown>;
}): Promise<BulkResult> {
  if (!input.boardId.trim()) {
    return { ok: false, message: "보드 정보를 확인해주세요." };
  }

  const ids = Array.from(new Set(input.cardIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) {
    return { ok: false, message: "선택된 카드가 없습니다." };
  }

  const response = await fetch(apiV1Path("dashboard/cards/batch"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      boardId: input.boardId,
      cardIds: ids,
      action: input.action,
      payload: input.payload,
    }),
  });

  const data = (await response.json()) as { ok?: boolean; updated?: number; error?: string };
  if (!response.ok || !data.ok) {
    return { ok: false, message: data.error ?? "일괄 작업을 수행하지 못했습니다." };
  }

  return { ok: true, updated: typeof data.updated === "number" ? data.updated : ids.length };
}
