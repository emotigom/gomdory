export type BoardActivityAction =
  | "card_created"
  | "card_updated"
  | "card_attachment_added"
  | "card_link_added";

export type BoardActivityItem = {
  id: string;
  createdAt: string;
  action: BoardActivityAction;
  cardId: string | null;
};

const ACTION_LABELS: Record<BoardActivityAction, string> = {
  card_created: "카드 생성",
  card_updated: "카드 수정",
  card_attachment_added: "파일 첨부",
  card_link_added: "링크 추가",
};

export function formatBoardActivityLabel(action: BoardActivityAction): string {
  return ACTION_LABELS[action] ?? "활동";
}
